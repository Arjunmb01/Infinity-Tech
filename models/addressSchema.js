const { boolean } = require('joi');
const mongoose = require('mongoose');
const { Schema } = mongoose;

const addressSchema = new Schema({
    userID: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: [true, "User ID is required"]
    },
    address: [{
        addressType: {
            type: String,
            required: [true, "Address Type is required"]
        },
        name: {
            type: String,
            required: [true, "Name is required"]
        },
        address: {
            type: String,
            required: [true, "Address is required"]
        },
        city: {
            type: String,
            required: [true, "City is required"]
        },
        landmark: {
            type: String,
            required: [true, "Landmark is required"]
        },
        state: {
            type: String,
            required: [true, "State is required"]
        },
        pincode: {
            type: Number,
            required: [true, "Pincode is required"]
        },
        phone: {
            type: String,
            required: [true, "Phone number is required"],
            match: [/^\d{10}$/, "Phone number must be 10 digits"]
        },
        isDefault: {
            type: Boolean,
            default: false
        },
        
    }],

});

const Address = mongoose.model("Address", addressSchema);

module.exports = Address;
