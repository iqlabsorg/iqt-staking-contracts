// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import {IStakingManagement} from "./IStakingManagement.sol";
import {Constants} from "../library/Constants.sol";

contract StakingManagement is IStakingManagement, Ownable {
    using EnumerableSet for EnumerableSet.UintSet;

    /**
     * @dev Staking token (IQT).
     */
    IERC20 internal stakingToken;

    /**
     * @dev Staking plans.
     */
    mapping(uint256 => StakingPlan) internal _stakingPlans;

    /**
     * @dev Staking plan IDs.
     */
    EnumerableSet.UintSet private _stakingPlanIds;

    /**
     * @dev Whether or not withdrawals are enabled.
     */
    bool internal _withdrawalEnabled;

    /**
     * @dev Minimum stake.
     */
    uint256 internal _minimumStake;

    /**
     * @dev Maximum stake.
     */
    uint256 internal _maximumStake;

    /**
     * @dev Constructor.
     * @param _stakingToken Staking token (IQT).
     */
    constructor(address _stakingToken) {
        stakingToken = IERC20(_stakingToken);
        _withdrawalEnabled = false;
    }

    /**
     * @inheritdoc IStakingManagement
     */
    function addStakingPlan(uint256 duration, uint16 apy) external override onlyOwner returns (uint256) {
        if (duration == 0) revert DurationMustBeGreaterThanZero();
        if (apy == 0 && apy > Constants.MAX_APY) revert APYMustBeWithinRange();

        uint256 planId = _stakingPlanIds.length();
        _stakingPlans[planId] = StakingPlan({duration: duration, apy: apy});
        _stakingPlanIds.add(planId);

        return planId;
    }

    /**
     * @inheritdoc IStakingManagement
     */
    function updateStakingPlan(uint256 planId, uint256 duration, uint16 apy) external override onlyOwner {
        _checkStakingPlanExists(planId);

        if (duration == 0) revert DurationMustBeGreaterThanZero();
        if (apy == 0 && apy > Constants.MAX_APY) revert APYMustBeWithinRange();

        _stakingPlans[planId] = StakingPlan({duration: duration, apy: apy});
    }

    /**
     * @inheritdoc IStakingManagement
     */
    function removeStakingPlan(uint256 planId) external override onlyOwner {
        _checkStakingPlanExists(planId);
        _stakingPlanIds.remove(planId);
        delete _stakingPlans[planId];
    }

    /**
     * @inheritdoc IStakingManagement
     */
    function enableWithdraw() external override onlyOwner {
        _withdrawalEnabled = true;
    }

    /**
     * @inheritdoc IStakingManagement
     */
    function disableWithdraw() external override onlyOwner {
        _withdrawalEnabled = false;
    }

    /**
     * @inheritdoc IStakingManagement
     */
    function setStakingLimits(uint256 minimumStake, uint256 maximumStake) external override onlyOwner {
        if (minimumStake > maximumStake) revert MinimumStakeMustBeLessThanOrEqualToMaximumStake();
        _minimumStake = minimumStake;
        _maximumStake = maximumStake;
    }

    /**
     * @inheritdoc IStakingManagement
     */
    function setMininumStake(uint256 minimumStake) external override onlyOwner {
        if (minimumStake > _maximumStake) revert MinimumStakeMustBeLessThanOrEqualToMaximumStake();
        _minimumStake = minimumStake;
    }

    /**
     * @inheritdoc IStakingManagement
     */
    function setMaximumStake(uint256 maximumStake) external override onlyOwner {
        if (_minimumStake > maximumStake) revert MinimumStakeMustBeLessThanOrEqualToMaximumStake();
        _maximumStake = maximumStake;
    }

    /**
     * @inheritdoc IStakingManagement
     */
    function checkStakingPlanExists(uint256 planId) external view override {
        _checkStakingPlanExists(planId);
    }

    /**
     * @inheritdoc IStakingManagement
     */
    function getStakingToken() external view override returns (address) {
        return address(stakingToken);
    }

    /**
     * @inheritdoc IStakingManagement
     */
    function getStakingPlan(uint256 planId) external view override returns (StakingPlan memory) {
        _checkStakingPlanExists(planId);
        return _stakingPlans[planId];
    }

    /**
     * @inheritdoc IStakingManagement
     */
    function getStakingPlans(uint256 offset, uint256 limit) external view override returns (StakingPlan[] memory) {
        uint256 planCount = _stakingPlanIds.length();
        if (offset >= planCount) {
            return new StakingPlan[](0);
        }

        if (offset + limit > planCount) {
            limit = planCount - offset;
        }

        StakingPlan[] memory plans = new StakingPlan[](limit);
        for (uint256 i = 0; i < limit; i++) {
            uint256 planId = _stakingPlanIds.at(offset + i);
            plans[i] = _stakingPlans[planId];
        }

        return plans;
    }

    /**
     * @inheritdoc IStakingManagement
     */
    function isWithdrawEnabled() external view override returns (bool) {
        return _withdrawalEnabled;
    }

    /**
     * @inheritdoc IStakingManagement
     */
    function getStakingLimits() external view override returns (uint256 minimumStake, uint256 maximumStake) {
        return (_minimumStake, _maximumStake);
    }

    /**
     * @inheritdoc IStakingManagement
     */
    function getMinimumStake() external view override returns (uint256) {
        return _minimumStake;
    }

    /**
     * @inheritdoc IStakingManagement
     */
    function getMaximumStake() external view override returns (uint256) {
        return _maximumStake;
    }

    /**
     * @dev Reverts if the staking plan does not exist.
     * @param planId Unique ID of the staking plan.
     */
    function _checkStakingPlanExists(uint256 planId) internal view {
        if (!_stakingPlanIds.contains(planId)) revert StakingPlanDoesNotExist(planId);
    }
}
