function generateCouponCode(length = 8) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

    let couponCode = letters.charAt(Math.floor(Math.random() * letters.length)); // Ensure the first character is a letter

    for (let i = 1; i < length; i++) {
        couponCode += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    return couponCode;
}

module.exports = generateCouponCode;
