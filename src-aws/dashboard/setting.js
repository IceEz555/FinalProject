/**
 * Script for the Settings page.
 * NOTE: Currently, this script only simulates functionality.
 * Actual persistence requires backend implementation.
 */

// =================================================================
// DOM Elements
// =================================================================
const timezoneSelect = document.getElementById('device-timezone');
const currencySelect = document.getElementById('currency');
const rateInput = document.getElementById('electricity-rate');
const saveBtn = document.getElementById('save-settings-btn');
const successAlert = document.getElementById('save-success-alert');

const deleteDataBtn = document.getElementById('delete-data-btn');
const deleteConfirmModal = document.getElementById('delete-confirm-modal');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const confirmTextInput = document.getElementById('confirm-text-input');


// =================================================================
// Functions
// =================================================================

/**
 * Loads initial (or saved) settings into the form.
 * This version uses mock/default values.
 */
function loadInitialSettings() {
    console.log("Loading initial settings...");
    timezoneSelect.value = 'Asia/Bangkok';
    currencySelect.value = 'THB';
    rateInput.value = '4.00';
}

/**
 * Handles the "Save Settings" button click.
 */
function handleSaveSettings() {
    const settingsData = {
        timezone: timezoneSelect.value,
        currency: currencySelect.value,
        rate: rateInput.value,
    };
    console.log("Saving settings...", settingsData);

    saveBtn.disabled = true;
    saveBtn.innerText = 'Saving...';

    // Simulate sending data to the backend
    setTimeout(() => {
        saveBtn.disabled = false;
        saveBtn.innerText = 'Save Changes';
        
        successAlert.classList.remove('hidden');
        setTimeout(() => {
            successAlert.classList.add('hidden');
        }, 3000);

    }, 1000);
}

/**
 * Shows the delete confirmation modal.
 */
function showDeleteModal() {
    // Reset state every time the modal is opened
    confirmTextInput.value = '';
    confirmDeleteBtn.disabled = true;
    deleteConfirmModal.classList.remove('hidden');
}

/**
 * Hides the delete confirmation modal.
 */
function hideDeleteModal() {
    deleteConfirmModal.classList.add('hidden');
}

/**
 * Handles the final delete confirmation.
 */
function handleConfirmDelete() {
    console.log("Deleting all data...");
    confirmDeleteBtn.disabled = true;
    confirmDeleteBtn.innerText = 'Deleting...';

    // Simulate calling an API to delete data
    setTimeout(() => {
        alert("All data has been deleted successfully (simulation).");
        
        confirmDeleteBtn.disabled = false;
        confirmDeleteBtn.innerText = 'Confirm Delete';
        hideDeleteModal();
        
    }, 1500);
}

/**
 * Checks the input in the confirmation text field.
 * Enables the delete button only if the input is 'confirm'.
 */
function validateConfirmText() {
    if (confirmTextInput.value.toLowerCase() === 'confirm') {
        confirmDeleteBtn.disabled = false;
    } else {
        confirmDeleteBtn.disabled = true;
    }
}


// =================================================================
// Script Initialization
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    loadInitialSettings();
    saveBtn.addEventListener('click', handleSaveSettings);

    // Add event listeners for the delete functionality
    deleteDataBtn.addEventListener('click', showDeleteModal);
    cancelDeleteBtn.addEventListener('click', hideDeleteModal);
    confirmDeleteBtn.addEventListener('click', handleConfirmDelete);
    confirmTextInput.addEventListener('input', validateConfirmText);
    
    deleteConfirmModal.addEventListener('click', (event) => {
        if (event.target === deleteConfirmModal) {
            hideDeleteModal();
        }
    });
});
