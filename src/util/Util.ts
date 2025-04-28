import { QuadContainer } from "../operators/s2r";


/**
 *
 * @param a
 * @param b
 */
export function lcm(a: number, b: number): number {
    // Calculate the least common multiple (LCM) of two numbers
    // using the formula: LCM(a, b) = |a * b| / GCD(a, b)
    // where GCD is the greatest common divisor.
    // If either a or b is 0, return 0
    return (!a || !b) ? 0 : Math.abs(a * b) / gcd(a, b);
}

/**
 *
 * @param a
 * @param b
 */
function gcd(a: number, b: number): number {
    return b === 0 ? a : gcd(b, a % b);
}

export type JoinFunction = (a: QuadContainer, b: QuadContainer) => QuadContainer;