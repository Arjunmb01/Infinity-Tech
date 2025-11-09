document.addEventListener('DOMContentLoaded', () => {
    // Open Add Address Form
    document.getElementById('createNewAddressBtn').addEventListener('click', () => {
        document.getElementById('addAddressModal').classList.remove('hidden');
    });

    // Close Add Address Form
    document.getElementById('closeAddAddressBtn').addEventListener('click', () => {
        document.getElementById('addAddressModal').classList.add('hidden');
    });

    // Open Edit Form
    document.querySelectorAll('.editAddressBtn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const name = btn.dataset.name;
            const address = btn.dataset.address;
            const landmark = btn.dataset.landmark;
            const city = btn.dataset.city;
            const state = btn.dataset.state;
            const pincode = btn.dataset.pincode;
            const phone = btn.dataset.phone;

            document.getElementById('editId').value = id;
            document.getElementById('editName').value = name;
            document.getElementById('editAddress').value = address;
            document.getElementById('editLandmark').value = landmark;
            document.getElementById('editCity').value = city;
            document.getElementById('editState').value = state;
            document.getElementById('editPincode').value = pincode;
            document.getElementById('editPhone').value = phone;
            document.getElementById('editAddressForm').action = `/edit-address/${id}`;
            document.getElementById('editModal').classList.remove('hidden');
        });
    });

    // Close Edit Form
    document.getElementById('closeEditBtn').addEventListener('click', () => {
        document.getElementById('editModal').classList.add('hidden');
    });

    // Toggle Default Address
    document.querySelectorAll('.toggleDefaultBtn').forEach(btn => {
        btn.addEventListener('click', () => {
            const addressId = btn.dataset.id;
            fetch(`/set-default-address/${addressId}`, { method: 'POST' })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        location.reload();
                    } else {
                        Swal.fire('Error', 'Failed to update default address.', 'error');
                    }
                });
        });
    });

    // Delete Address
    let currentAddressId = null;
    document.querySelectorAll('.deleteAddressBtn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentAddressId = btn.dataset.id;
            Swal.fire({
                title: 'Are you sure?',
                text: "You won't be able to revert this!",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'Yes, delete it!'
            }).then(result => {
                if (result.isConfirmed) {
                    fetch(`/delete-address/${currentAddressId}`, { method: 'DELETE' })
                        .then(response => response.json())
                        .then(data => {
                            if (data.success) {
                                Swal.fire('Deleted!', 'Your address has been deleted.', 'success').then(() => {
                                    location.reload();
                                });
                            } else {
                                Swal.fire('Error', 'Failed to delete address.', 'error');
                            }
                        })
                        .catch(() => Swal.fire('Error', 'Something went wrong!', 'error'));
                }
            });
        });
    });

    // Form Validation and Submission for Add Address
    document.getElementById('addAddressForm').addEventListener('submit', function (e) {
        e.preventDefault();
        const form = this;
        const name = form.name.value.trim();
        const address = form.address.value.trim();
        const landmark = form.landmark.value.trim();
        const city = form.city.value.trim();
        const state = form.state.value.trim();
        const pincode = form.pincode.value.trim();
        const phone = form.phone.value.trim();
        const addressType = form.addressType.value.trim();

        const textRegex = /^[A-Za-z\s]+$/;
        const pincodeRegex = /^\d{6}$/;
        const phoneRegex = /^\d{10}$/;

        if (!addressType) return Swal.fire('Validation Error', 'Please select an address type.', 'warning');
        if (!name.match(textRegex)) return Swal.fire('Validation Error', 'Full Name should only contain letters and spaces.', 'warning');
        if (!address) return Swal.fire('Validation Error', 'Address is required.', 'warning');
        if (!landmark.match(textRegex)) return Swal.fire('Validation Error', 'Landmark should only contain letters and spaces.', 'warning');
        if (!city.match(textRegex)) return Swal.fire('Validation Error', 'City should only contain letters and spaces.', 'warning');
        if (!state.match(textRegex)) return Swal.fire('Validation Error', 'State should only contain letters and spaces.', 'warning');
        if (!pincode.match(pincodeRegex)) return Swal.fire('Validation Error', 'Please enter a valid 6-digit Indian Pincode.', 'warning');
        if (!phone.match(phoneRegex)) return Swal.fire('Validation Error', 'Please enter a valid 10-digit Indian phone number.', 'warning');

        form.submit();
    });
});