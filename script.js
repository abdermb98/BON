// State management
let images = [];
let isCapturing = false;

// DOM Elements
const form = document.getElementById('dataForm');
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const fileInput = document.getElementById('fileInput');
const imagePreview = document.getElementById('imagePreview');
const imageError = document.getElementById('imageError');
const captureBtn = document.getElementById('captureBtn');
const uploadBtn = document.getElementById('uploadBtn');
const saveBtn = document.getElementById('saveBtn');
const submitBtn = document.getElementById('submitBtn');
const statusDiv = document.getElementById('status');

// Helper Functions
const showStatus = (message, type) => {
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${type}`;
    setTimeout(() => {
        statusDiv.className = 'status-message';
    }, 3000);
};

const addImage = (file) => {
    const id = Math.random().toString(36).substr(2, 9);
    const preview = URL.createObjectURL(file);
    images.push({ id, file, preview });
    updateImagePreview();
};

const updateImagePreview = () => {
    imagePreview.innerHTML = images.map(image => `
        <div class="image-preview-item">
            <img src="${image.preview}" alt="Preview">
            <button onclick="removeImage('${image.id}')" title="Remove image">×</button>
        </div>
    `).join('');
    
    imageError.textContent = images.length === 0 ? 'At least one image is required' : '';
};

const removeImage = (id) => {
    const image = images.find(img => img.id === id);
    if (image) {
        URL.revokeObjectURL(image.preview);
    }
    images = images.filter(img => img.id !== id);
    updateImagePreview();
};

// Camera Functions
const startCamera = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        video.srcObject = stream;
        video.play();
        video.hidden = false;
        isCapturing = true;
        captureBtn.textContent = '📸 Capture';
    } catch (err) {
        console.error('Error accessing camera:', err);
        showStatus('Unable to access camera. Please check permissions.', 'error');
    }
};

const stopCamera = () => {
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
        video.srcObject = null;
    }
    video.hidden = true;
    isCapturing = false;
    captureBtn.textContent = '📷 Capture';
};

const captureImage = () => {
    if (!isCapturing) {
        startCamera();
        return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    
    canvas.toBlob((blob) => {
        const file = new File([blob], `image-${Date.now()}.jpg`, { type: 'image/jpeg' });
        addImage(file);
        stopCamera();
    }, 'image/jpeg', 0.9);
};

// Form Functions
const validateForm = () => {
    const requiredFields = ['date', 'article', 'client', 'quantite'];
    const errors = [];

    requiredFields.forEach(field => {
        const input = document.getElementById(field);
        if (!input.value) {
            errors.push(`${field.charAt(0).toUpperCase() + field.slice(1)} is required`);
        }
    });

    if (images.length === 0) {
        errors.push('At least one image is required');
    }

    return errors;
};

const generatePdf = async (formData, images) => {
    // Simulated PDF generation
    console.log('Generating PDF with:', formData, images);
    return new Blob(['PDF content'], { type: 'application/pdf' });
};

const sendToGoogleSheets = async (formData) => {
    try {
        const response = await fetch('https://script.google.com/macros/s/AKfycbzyYwxv__92iTp2FWeSEKVmCMmRfst5bOHlNho-f-yUt_tVNmzWp_ph_h-czwGYMQJz/exec', {
            method: 'POST',
            body: JSON.stringify(formData),
            mode: 'no-cors'
        });
        return true;
    } catch (error) {
        console.error('Error sending to Google Sheets:', error);
        return false;
    }
};

const sendToTelegram = async (pdfBlob, formData) => {
    try {
        const formDataObj = new FormData();
        formDataObj.append('chat_id', '-1002408201424');
        
        // Use N° BON as the PDF filename, fallback to timestamp if not provided
        const pdfName = formData.nBon ? 
            `${formData.nBon}.pdf` : 
            `submission_${Date.now()}.pdf`;
            
        formDataObj.append('document', pdfBlob, pdfName);
        formDataObj.append('caption', `New submission from ${formData.client}`);

        const response = await fetch('https://api.telegram.org/bot7914915084:AAFy5X26pPqYwDJU84jgBWWRt_7PqgPBvQg/sendDocument', {
            method: 'POST',
            body: formDataObj
        });

        const result = await response.json();
        return result.ok;
    } catch (error) {
        console.error('Error sending to Telegram:', error);
        return false;
    }
};

// Event Listeners
captureBtn.addEventListener('click', captureImage);

uploadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    Array.from(e.target.files).forEach(addImage);
    fileInput.value = '';
});

saveBtn.addEventListener('click', () => {
    const formData = {
        date: document.getElementById('date').value,
        article: document.getElementById('article').value,
        client: document.getElementById('client').value,
        nBon: document.getElementById('nBon').value,
        nTicket: document.getElementById('nTicket').value,
        quantite: document.getElementById('quantite').value
    };

    localStorage.setItem('formDraft', JSON.stringify({
        formData,
        timestamp: new Date().toISOString()
    }));

    showStatus('Draft saved successfully!', 'success');
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const errors = validateForm();
    if (errors.length > 0) {
        showStatus(errors.join(', '), 'error');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="icon">⏳</span> Processing...';

    const formData = {
        date: document.getElementById('date').value,
        article: document.getElementById('article').value,
        client: document.getElementById('client').value,
        nBon: document.getElementById('nBon').value,
        nTicket: document.getElementById('nTicket').value,
        quantite: parseInt(document.getElementById('quantite').value)
    };

    try {
        const pdfBlob = await generatePdf(formData, images);
        const [sheetsResult, telegramResult] = await Promise.all([
            sendToGoogleSheets(formData),
            sendToTelegram(pdfBlob, formData)
        ]);

        if (sheetsResult && telegramResult) {
            showStatus('Form submitted successfully!', 'success');
            form.reset();
            images = [];
            updateImagePreview();
        } else {
            throw new Error('Failed to submit form');
        }
    } catch (error) {
        console.error('Submission error:', error);
        showStatus('An error occurred while submitting the form', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="icon">📤</span> Submit';
    }
});
