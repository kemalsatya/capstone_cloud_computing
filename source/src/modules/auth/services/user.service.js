import { userRepository } from '../repositories/user.repository.js';

export async function provisionUser(mappedClaims) {
    return userRepository.provisionFromClaims(mappedClaims);
}
