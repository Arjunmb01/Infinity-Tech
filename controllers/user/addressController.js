const Address = require('../../models/addressSchema');
const { body, validationResult } = require('express-validator');

// Validation middleware for address fields
const validateAddress = [
  body('addressType').notEmpty().withMessage('Address Type is required'),
  body('name')
    .isLength({ min: 2 }).withMessage('Name must be at least 2 characters')
    .matches(/^[A-Za-z\s]+$/).withMessage('Name must contain only letters'),
  body('address').isLength({ min: 5 }).withMessage('Address must be at least 5 characters'),
  body('city')
    .notEmpty().withMessage('City is required')
    .matches(/^[A-Za-z\s]+$/).withMessage('City must contain only letters'),
  body('landmark')
    .notEmpty().withMessage('Landmark is required')
    .matches(/^[A-Za-z\s]+$/).withMessage('Landmark must contain only letters'),
  body('state')
    .notEmpty().withMessage('State is required')
    .matches(/^[A-Za-z\s]+$/).withMessage('State must contain only letters'),
  body('pincode')
    .matches(/^\d{6}$/).withMessage('Pincode must be exactly 6 digits'),
  body('phone')
    .matches(/^\d{10}$/).withMessage('Phone number must be exactly 10 digits')
];

exports.getAddress = async (req, res) => {
  try {
    const userID = req.session?.user?._id;
    if (!userID) throw new Error('User not authenticated');

    const userProfile = req.session.user;
    if (!userProfile?.name || !userProfile?.email) {
      throw new Error('User profile data incomplete');
    }

    const userAddress = await Address.findOne({ userID });

    res.render('user/address', {
      userAddresses: userAddress?.address || [],
      userProfile: {
        name: userProfile.name,
        email: userProfile.email
      },
      messages: {
        success: req.flash('success'),
        error: req.flash('error')
      }
    });
  } catch (error) {
    console.error('Error fetching address:', error);
    req.flash('error', error.message || 'Failed to load addresses');
    res.redirect('/login');
  }
};

exports.addAddress = [
  validateAddress,
  async (req, res) => {
    try {
      const userID = req.session?.user?._id;
      if (!userID) throw new Error('User not authenticated');

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array().map(err => err.msg).join(', ')
        });
      }

      const { addressType, name, address, city, landmark, state, pincode, phone } = req.body;

      let userAddress = await Address.findOne({ userID });
      if (!userAddress) {
        userAddress = new Address({ userID, address: [] });
      }

      // Check for duplicate address
      const isDuplicate = userAddress.address.some(addr =>
        addr.address === address &&
        addr.city === city &&
        addr.pincode === Number(pincode)
      );
      if (isDuplicate) {
        return res.status(400).json({
          success: false,
          message: 'This address already exists'
        });
      }

      const newAddress = {
        addressType,
        name,
        address,
        city,
        landmark,
        state,
        pincode: Number(pincode),
        phone,
        isDefault: userAddress.address.length === 0
      };

      userAddress.address.push(newAddress);
      await userAddress.save();

      res.status(201).json({
        success: true,
        message: 'Address added successfully'
      });
    } catch (error) {
      console.error('Error adding address:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to add address'
      });
    }
  }
];

exports.editAddress = async (req, res) => {
  try {
    const userID = req.session?.user?._id;
    if (!userID) throw new Error('User not authenticated');

    const userAddress = await Address.findOne({ userID });
    if (!userAddress) throw new Error('No addresses found');

    const address = userAddress.address.id(req.params.id);
    if (!address) throw new Error('Address not found');

    res.render('user/edit-address', {
      address,
      messages: {
        success: req.flash('success'),
        error: req.flash('error')
      }
    });
  } catch (error) {
    console.error('Error fetching address for edit:', error);
    req.flash('error', error.message || 'Failed to load address for editing');
    res.redirect('/address');
  }
};

exports.updateAddress = [
  validateAddress,
  async (req, res) => {
    try {
      const { id } = req.params;
      const userID = req.session?.user?._id;
      if (!userID) throw new Error('User not authenticated');

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array().map(err => err.msg).join(', ')
        });
      }

      const userAddress = await Address.findOne({ userID });
      if (!userAddress) throw new Error('User address not found');

      const addressIndex = userAddress.address.findIndex(addr => addr._id.toString() === id);
      if (addressIndex === -1) throw new Error('Address not found');

      const updatedAddress = {
        ...userAddress.address[addressIndex]._doc,
        ...req.body,
        pincode: Number(req.body.pincode)
      };

      userAddress.address[addressIndex] = updatedAddress;
      await userAddress.save();

      res.json({
        success: true,
        message: 'Address updated successfully'
      });
    } catch (error) {
      console.error('Error updating address:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to update address'
      });
    }
  }
];

exports.setDefaultAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userID = req.session?.user?._id;
    if (!userID) throw new Error('User not authenticated');

    let userAddress = await Address.findOne({ userID });
    if (!userAddress) throw new Error('User address not found');

    userAddress.address = userAddress.address.map(addr => ({
      ...addr._doc,
      isDefault: false
    }));

    const addressIndex = userAddress.address.findIndex(addr => addr._id.toString() === addressId);
    if (addressIndex === -1) throw new Error('Address not found');

    userAddress.address[addressIndex].isDefault = true;
    await userAddress.save();

    res.json({
      success: true,
      message: 'Default address updated successfully'
    });
  } catch (error) {
    console.error('Error setting default address:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to set default address'
    });
  }
};

exports.deleteAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const userID = req.session?.user?._id;
    if (!userID) throw new Error('User not authenticated');

    let userAddress = await Address.findOne({ userID });
    if (!userAddress) throw new Error('No addresses found');

    const addressIndex = userAddress.address.findIndex(addr => addr._id.toString() === addressId);
    if (addressIndex === -1) throw new Error('Address not found');

    userAddress.address.splice(addressIndex, 1);
    await userAddress.save();

    res.status(200).json({
      success: true,
      message: 'Address deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting address:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete address'
    });
  }
};