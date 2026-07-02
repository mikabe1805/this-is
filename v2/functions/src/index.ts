/**
 * v2 server surface — deliberately small (blueprint: 2 triggers + 1 callable +
 * 1 daily job). Week 2 ships only the getHours callable. onPinWrite /
 * onSharedBoardWrite / the daily coords-refresh job land in W3–W4.
 */
export { getHours } from './getHours'
