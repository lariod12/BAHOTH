// Combat group - public API
export {
    calculateCombatResult, getCombatKey, isCombatCompleted, markCombatCompleted,
    clearCompletedCombatForPlayer, getEnemyInRoom, mapServerPhaseToLocal, executeForcedAttack
} from './combatCalc.js';

export {
    openCombatModal, closeCombatModal, showCombatResultNotification,
    openDamageDistributionModal, closeDamageDistributionModal
} from './combatManager.js';

export { renderCombatModal, renderDamageDistributionModal } from './combatRenderer.js';
