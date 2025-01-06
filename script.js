// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const previewImage = document.getElementById('previewImage');
const resultArea = document.getElementById('resultArea');
const processingOverlay = document.getElementById('processingOverlay');
const progressBar = document.getElementById('progressBar');
const statusText = document.getElementById('statusText');
const historyList = document.getElementById('historyList');
const toast = document.getElementById('toast');

// Image processing controls
const brightnessControl = document.getElementById('brightness');
const contrastControl = document.getElementById('contrast');
const thresholdControl = document.getElementById('threshold');

// Action buttons
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const speakBtn = document.getElementById('speakBtn');
const uploadBtn = document.getElementById('uploadBtn');
const captureBtn = document.getElementById('captureBtn');
const pasteBtn = document.getElementById('pasteBtn');

// Stats
let processedCount = 0;
let totalProcessingTime = 0;

// History storage
const MAX_HISTORY_ITEMS = 5;
let history = JSON.parse(localStorage.getItem('ocrHistory')) || [];

// Event Listeners
dropZone.addEventListener('dragover', handleDragOver);
dropZone.addEventListener('dragleave', handleDragLeave);
dropZone.addEventListener('drop', handleDrop);
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);

// Image processing controls events
brightnessControl.addEventListener('input', updateImageProcessing);
contrastControl.addEventListener('input', updateImageProcessing);
thresholdControl.addEventListener('input', updateImageProcessing);

// Button events
copyBtn.addEventListener('click', copyText);
downloadBtn.addEventListener('click', downloadText);
speakBtn.addEventListener('click', speakText);
uploadBtn.addEventListener('click', () => fileInput.click());
captureBtn.addEventListener('click', captureImage);
pasteBtn.addEventListener('click', handlePaste);

// Drag and Drop Handlers
function handleDragOver(e) {
    e.preventDefault();
    dropZone.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
}

function handleDrop(e) {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        processImage(file);
    } else {
        showToast('Please drop an image file');
    }
}

// File Selection Handler
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file && file.type.startsWith('image/')) {
        processImage(file);
    } else {
        showToast('Please select an image file');
    }
}

// Image Processing
async function processImage(file) {
    const startTime = performance.now();
    
    try {
        // Preview image
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImage.src = e.target.result;
            previewImage.style.display = 'block';
        };
        reader.readAsDataURL(file);

        // Show processing overlay
        processingOverlay.style.display = 'flex';
        progressBar.style.width = '0%';
        
        // Initialize Tesseract
        const worker = await Tesseract.createWorker({
            logger: progress => {
                updateProgress(progress);
            }
        });

        // Load language
        statusText.textContent = 'Loading language...';
        await worker.loadLanguage(document.getElementById('langSelect').value);
        await worker.initialize(document.getElementById('langSelect').value);

        // Process image with current settings
        statusText.textContent = 'Recognizing text...';
        const { data: { text } } = await worker.recognize(file);
        
        // Update UI
        resultArea.textContent = text;
        
        // Update stats
        const endTime = performance.now();
        processedCount++;
        totalProcessingTime += (endTime - startTime);
        updateStats();

        // Add to history
        addToHistory({
            timestamp: new Date().toISOString(),
            text: text.substring(0, 50) + '...',
            fullText: text,
            imageUrl: previewImage.src
        });

        await worker.terminate();
        showToast('Text extraction completed');

    } catch (error) {
        showToast('Error processing image: ' + error.message);
    } finally {
        processingOverlay.style.display = 'none';
    }
}

// Progress Updates
function updateProgress(progress) {
    const percent = progress.progress * 100;
    progressBar.style.width = `${percent}%`;
    statusText.textContent = progress.status;
}

// Image Processing Controls
function updateImageProcessing() {
    if (!previewImage.src) return;
    
    const brightness = brightnessControl.value;
    const contrast = contrastControl.value;
    const threshold = thresholdControl.value;

    previewImage.style.filter = `
        brightness(${brightness}%) 
        contrast(${contrast}%) 
        threshold(${threshold})
    `;
}

// History Management
function addToHistory(item) {
    history.unshift(item);
    if (history.length > MAX_HISTORY_ITEMS) {
        history.pop();
    }
    localStorage.setItem('ocrHistory', JSON.stringify(history));
    updateHistoryUI();
}

function updateHistoryUI() {
    historyList.innerHTML = '';
    history.forEach((item, index) => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.innerHTML = `
            <div>${new Date(item.timestamp).toLocaleString()}</div>
            <div>${item.text}</div>
        `;
        historyItem.addEventListener('click', () => {
            previewImage.src = item.imageUrl;
            previewImage.style.display = 'block';
            resultArea.textContent = item.fullText;
        });
        historyList.appendChild(historyItem);
    });
}

// Utility Functions
function showToast(message) {
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function updateStats() {
    document.querySelector('.stat-number').textContent = processedCount;
    const avgTime = totalProcessingTime / processedCount / 1000;
    document.querySelectorAll('.stat-number')[1].textContent = 
        `${avgTime.toFixed(1)}s`;
}

// Text Actions
function copyText() {
    navigator.clipboard.writeText(resultArea.textContent)
        .then(() => showToast('Text copied to clipboard'))
        .catch(err => showToast('Failed to copy text'));
}

function downloadText() {
    const blob = new Blob([resultArea.textContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ocr-result.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Text downloaded');
}

function speakText() {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(resultArea.textContent);
        speechSynthesis.speak(utterance);
        showToast('Starting text-to-speech');
    } else {
        showToast('Text-to-speech not supported in this browser');
    }
}

// Image Capture
async function captureImage() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const video = document.createElement('video');
        video.srcObject = stream;
        await video.play();

        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);

        stream.getTracks().forEach(track => track.stop());

        canvas.toBlob(blob => {
            processImage(blob);
        }, 'image/jpeg');

    } catch (error) {
        showToast('Failed to access camera: ' + error.message);
    }
}

// Clipboard Paste
async function handlePaste() {
    try {
        const items = await navigator.clipboard.read();
        for (const item of items) {
            if (item.types.includes('image/png') || item.types.includes('image/jpeg')) {
                const blob = await item.getType(item.types.find(type => type.startsWith('image/')));
                processImage(blob);
                return;
            }
        }
        showToast('No image found in clipboard');
    } catch (error) {
        showToast('Failed to access clipboard: ' + error.message);
    }
}

// Initialize
updateHistoryUI();
updateStats();

