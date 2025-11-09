const { ref, number, required } = require('joi');
const mongoose = require('mongoose');
const { Schema } = mongoose;





const offerSchema =  new Schema({
    name : {
        type:String,
        required: true
    },
    description: {
        type: String
    },
    discountType:{
        type:String,
        enum:['percentage','fixed'],
        required: true
    },
    discountValue:{
        type: Number,
        required:true
    },
    Categories:[{
        type:Schema.Types.ObjectId,
        ref:'LaptopCategory'
    }],
    Product:[{
        type:Schema.Types.ObjectId,
        ref:'Product'
    }],
    minimumAmount:{
        type:Number,
        default:0
    },
    maxDiscount:{
        type:Number
    },
    startDate:{
        type:Date,
        required:true
    },
    endDate:{
        type:Date,
        required: true
    },
    isActive:{
        type:Boolean,
        default:true
    },
    createdAt:{
        type: Date,
        default:Date.now
    }
})




module.exports = mongoose.model('offer',offerSchema)