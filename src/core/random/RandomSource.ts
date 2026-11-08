/** 宿主提供 [0, 1) 随机数；核心与测试共用此契约，不读取全局随机源。 */
export type RandomSource = () => number
