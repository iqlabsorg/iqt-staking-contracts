// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IStakingManagement} from "./IStakingManagement.sol";
import {StakingRoles} from "../library/StakingRoles.sol";
import {Constants} from "../library/Constants.sol";
import {IStaking} from "../staking/IStaking.sol";

contract StakingManagement is IStakingManagement, AccessControl {
    using EnumerableSet for EnumerableSet.UintSet;

    /**
     * @dev Staking token (IQT).
     */
    IERC20 internal immutable stakingToken;

    /**
     * @dev IStakingManagement instance
     */
    IStaking internal _staking;

    /**
     * @dev Staking plans.
     */
    mapping(uint256 => StakingPlan) internal _stakingPlans;

    /**
     * @dev Staking plan ID counter.
     * Starts at 0 and being defined in the constructor, then being increment in addStakingPlan().
     */
    uint256 internal _latestStakingPlanId;

    /**
     * @dev Staking plan IDs.
     */
    EnumerableSet.UintSet internal _stakingPlanIds;

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

    modifier onlyStakingManager() {
        if (!hasRole(StakingRoles.STAKING_MANAGER_ROLE, _msgSender()) && !hasRole(DEFAULT_ADMIN_ROLE, _msgSender())) {
            revert CallerIsNotAStakingManager();
        }
        _;
    }

    /**
     * @dev Constructor.
     * @param _stakingToken Staking token (IQT).
     */
    constructor(address _stakingToken) {
        stakingToken = IERC20(_stakingToken);
        _withdrawalEnabled = false;
        _latestStakingPlanId = 0;

        _setupRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _setupRole(StakingRoles.STAKING_MANAGER_ROLE, _msgSender());
    }

    /**
     * @inheritdoc IStakingManagement
     */
    function addStakingPlan(uint256 duration, uint16 apy) external override onlyStakingManager returns (uint256) {
        if (duration < Constants.SECONDS_IN_DAY) revert DurationMustBeGreaterThanOneDay();
        if (apy == 0 || apy > Constants.HUNDRED_PERCENT) revert APYMustBeWithinRange();

        unchecked {
            _latestStakingPlanId++;
            uint256 planId = _latestStakingPlanId;
            _stakingPlans[planId] = StakingPlan({duration: duration, apy: apy});
            // check that plan successfully added
            if(!_stakingPlanIds.add(planId)) {
                revert ErrorDuringAddingStakingPlan(duration, apy);
            }

            return planId;
        }
    }

    /**
     * @inheritdoc IStakingManagement
     */
    function removeStakingPlan(uint256 planId) external override onlyStakingManager {
        _checkStakingPlanExists(planId);
        _checkNoActiveStakes(planId);
        // check that plan successfully removed
        if(!_stakingPlanIds.remove(planId)) {
            revert ErrorDuringRemovingStakingPlan(planId);
        }
        delete _stakingPlans[planId];
    }

    /**
     * @inheritdoc IStakingManagement
     */
    function enableWithdraw() external override onlyStakingManager {
        _withdrawalEnabled = true;
    }

    /**
     * @inheritdoc IStakingManagement
     */
    function disableWithdraw() external override onlyStakingManager {
        _withdrawalEnabled = false;
    }

    /**
     * @inheritdoc IStakingManagement
     */
    function setStakingLimits(uint256 minimumStake, uint256 maximumStake) external override onlyStakingManager {
        if (minimumStake > maximumStake) revert MinimumStakeMustBeLessThanOrEqualToMaximumStake();
        _minimumStake = minimumStake;
        _maximumStake = maximumStake;

        emit StakingLimitsUpdated(minimumStake, maximumStake);
    }

    /**
     * @inheritdoc IStakingManagement
     */
    function setMininumStake(uint256 minimumStake) external override onlyStakingManager {
        if (minimumStake > _maximumStake) revert MinimumStakeMustBeLessThanOrEqualToMaximumStake();
        _minimumStake = minimumStake;

        emit MinimumStakeUpdated(minimumStake);
    }

    /**
     * @inheritdoc IStakingManagement
     */
    function setMaximumStake(uint256 maximumStake) external override onlyStakingManager {
        if (_minimumStake > maximumStake) revert MinimumStakeMustBeLessThanOrEqualToMaximumStake();
        _maximumStake = maximumStake;

        emit MaximumStakeUpdated(maximumStake);
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
    function setStaking(address staking) external override onlyStakingManager {
        _staking = IStaking(staking);
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
    function getStakingPlans(uint256 offset, uint256 limit) external view override returns (StakingPlan[] memory, uint256[] memory) {
        uint256 planCount = _stakingPlanIds.length();
        if (offset >= planCount) {
            return (new StakingPlan[](0), new uint256[](0));
        }

        if (offset + limit > planCount) {
            limit = planCount - offset;
        }

        StakingPlan[] memory plans = new StakingPlan[](limit);
        uint256[] memory planIds = new uint256[](limit);
        unchecked {
            for (uint256 i = 0; i < limit; ++i) {
                uint256 planId = _stakingPlanIds.at(offset + i);
                plans[i] = _stakingPlans[planId];
                planIds[i] = planId;
            }
        }
        return (plans, planIds);
    }

    /**
     * @inheritdoc IStakingManagement
     */
    function getLatestStakingPlanId() external view override returns (uint256) {
        return _latestStakingPlanId;
    }

    /**
     * @inheritdoc IStakingManagement
     */
    function getStakingPlansAmount() external view override returns (uint256) {
        return _stakingPlanIds.length();
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
     * @inheritdoc IStakingManagement
     */
    function getStaking() external view override returns (address) {
        return address(_staking);
    }

    /**
     * @dev Reverts if the staking plan does not exist.
     * @param planId Unique ID of the staking plan.
     */
    function _checkStakingPlanExists(uint256 planId) internal view {
        if (!_stakingPlanIds.contains(planId)) revert StakingPlanDoesNotExist(planId);
    }

    /**
     * @dev Reverts if the staking plan has active stakes.
    */
    function _checkNoActiveStakes(uint256 planId) internal view {
        if (_staking.getStakesAmountPerPlan(planId) > 0) revert StakingPlanHasActiveStakes(planId);
    }
}
