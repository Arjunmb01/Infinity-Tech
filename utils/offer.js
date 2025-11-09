const Offer = require('../models/offerSchema');

async function getBestOfferForProduct(product) {
    try {
        
        const basePrice = product.price || 0; // Ensure basePrice is not undefined or negative
        let productOfferDiscount = product.productOffer || 0; // Product-specific offer (percentage)
        let categoryOfferDiscount = 0;
        let appliedOfferType = null; // To track which offer was applied

        // Validate basePrice
        if (basePrice <= 0) {
            return {
                originalPrice: basePrice,
                finalPrice: 0,
                discountAmount: 0,
                discountPercentage: 0,
                appliedOfferType: null
            };
        }

        // Fetch active category offers
        const currentDate = new Date();
        const offers = await Offer.find({
            Categories: product.category,
            startDate: { $lte: currentDate },
            endDate: { $gte: currentDate },
            isActive: true
        }).lean();

        // Compute the best category offer
        offers.forEach(offer => {
            if (offer.discountType === 'percentage') {
                const discount = offer.discountValue || 0; // Already a percentage
                let discountAmount = basePrice * (discount / 100);
                const cappedDiscount = offer.maxDiscount ? Math.min(discountAmount, offer.maxDiscount) : discountAmount;
                const effectiveDiscountPercentage = cappedDiscount / basePrice * 100; // Convert to percentage
                categoryOfferDiscount = Math.max(categoryOfferDiscount, effectiveDiscountPercentage);
            } else if (offer.discountType === 'fixed') {
                const discountAmount = offer.discountValue || 0;
                const effectiveDiscountPercentage = (discountAmount / basePrice) * 100; // Convert to percentage
                categoryOfferDiscount = Math.max(categoryOfferDiscount, effectiveDiscountPercentage);
            }
        });

        // Determine the best offer (in percentage)
        const bestOfferDiscountPercentage = Math.max(productOfferDiscount, categoryOfferDiscount);

        // Calculate discount amount and final price
        let discountAmount = (basePrice * bestOfferDiscountPercentage) / 100;
        let finalPrice = basePrice - discountAmount;

        // Ensure finalPrice is not negative
        if (finalPrice < 0) {
            finalPrice = 0;
            discountAmount = basePrice; // Adjust discount amount to match the basePrice
        }

        // Cap the discount percentage to 100% if it exceeds basePrice
        const effectiveDiscountPercentage = Math.min(bestOfferDiscountPercentage, 100);

        // Determine which offer was applied
        if (bestOfferDiscountPercentage === productOfferDiscount && productOfferDiscount > 0) {
            appliedOfferType = 'product';
        } else if (bestOfferDiscountPercentage === categoryOfferDiscount && categoryOfferDiscount > 0) {
            appliedOfferType = 'category';
        }

        return {
            originalPrice: basePrice,
            finalPrice: finalPrice,
            discountAmount: discountAmount,
            discountPercentage: effectiveDiscountPercentage, // Use capped percentage
            appliedOfferType: appliedOfferType
        };
    } catch (error) {
        console.error(`Error calculating offer for product ${product._id}:`, error);
        return {
            originalPrice: product.price || 0,
            finalPrice: product.price || 0,
            discountAmount: 0,
            discountPercentage: 0,
            appliedOfferType: null
        };
    }
}

module.exports = { getBestOfferForProduct };