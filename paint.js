// Program Paint Lengkap - JavaScript (DIPERBAIKI)
class PaintApp {
    constructor() {
        this.canvas = document.getElementById('drawContainer');
        this.ctx = this.canvas.getContext('2d');
        this.isDrawing = false;
        this.currentTool = 'smooth';
        this.currentColor = '#000000';
        this.lineWidth = 2;
        
        // History untuk undo/redo
        this.history = [];
        this.historyStep = -1;
        
        // Polygon drawing
        this.polygonPoints = [];
        this.isDrawingPolygon = false;
        
        // Temporary drawing
        this.tempCanvas = document.createElement('canvas');
        this.tempCtx = this.tempCanvas.getContext('2d');
        this.tempCanvas.width = this.canvas.width;
        this.tempCanvas.height = this.canvas.height;
        
        // Triangle for transformation
        this.triangle = null;
        this.selectedTriangle = null;
        
        // Drawing state
        this.startX = 0;
        this.startY = 0;
        this.currentX = 0;
        this.currentY = 0;
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.saveState();
        this.setupCanvas();
    }

    setupCanvas() {
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        this.ctx.lineWidth = this.lineWidth;
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.fillStyle = this.currentColor;
    }

    setupEventListeners() {
        // Drawing tool selection
        document.querySelectorAll('input[name="drawing-options"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.selectTool(e.target.id);
            });
        });

        // Canvas events
        this.canvas.addEventListener('mousedown', this.startDrawing.bind(this));
        this.canvas.addEventListener('mousemove', this.draw.bind(this));
        this.canvas.addEventListener('mouseup', this.stopDrawing.bind(this));
        this.canvas.addEventListener('dblclick', this.finishPolygon.bind(this));
        this.canvas.addEventListener('click', this.handleClick.bind(this));

        // Control buttons
        document.getElementById('btnUndo').addEventListener('click', this.undo.bind(this));
        document.getElementById('btnRedo').addEventListener('click', this.redo.bind(this));
        document.getElementById('option10').addEventListener('click', this.clearCanvas.bind(this));
        document.getElementById('btnFill').addEventListener('click', this.fillCanvas.bind(this));
        document.getElementById('btnChangeColor').addEventListener('click', this.changeColor.bind(this));

        // Color picker
        document.getElementById('colorPicker').addEventListener('change', this.updateColorPreview.bind(this));

        // Transformation buttons
        document.getElementById('trans1').addEventListener('click', () => this.transform('translate'));
        document.getElementById('trans2').addEventListener('click', () => this.transform('scale'));
        document.getElementById('trans3').addEventListener('click', () => this.transform('rotate'));
        document.getElementById('trans4').addEventListener('click', () => this.transform('flipH'));
        document.getElementById('trans5').addEventListener('click', () => this.transform('flipV'));
        document.getElementById('trans6').addEventListener('click', () => this.transform('shear'));
    }

    selectTool(toolId) {
        const toolMap = {
            'option1': 'smooth',    // Garis halus (lurus)
            'option2': 'fast',      // Garis cepat (lurus dengan snap)
            'option3': 'circle',
            'option4': 'ellipse',
            'option5': 'triangle',
            'option6': 'square',
            'option7': 'rectangle',
            'option8': 'polygon',
            'option9': 'free'       // Gambar bebas
        };
        
        this.currentTool = toolMap[toolId];
        this.polygonPoints = [];
        this.isDrawingPolygon = false;
        
        // Show/hide transformation panel
        const transformDiv = document.getElementById('divTransform');
        if (this.currentTool === 'triangle') {
            transformDiv.style.display = 'block';
        } else {
            transformDiv.style.display = 'none';
        }
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    startDrawing(e) {
        if (this.currentTool === 'polygon') {
            return; // Polygon menggunakan click events
        }

        this.isDrawing = true;
        const pos = this.getMousePos(e);
        this.startX = pos.x;
        this.startY = pos.y;
        this.currentX = pos.x;
        this.currentY = pos.y;

        // Save state for preview (untuk semua tools kecuali free)
        if (this.currentTool !== 'free') {
            this.previewState = this.canvas.toDataURL();
        }

        // Hanya free drawing yang langsung mulai path
        if (this.currentTool === 'free') {
            this.ctx.beginPath();
            this.ctx.moveTo(pos.x, pos.y);
        }
    }

    draw(e) {
        if (!this.isDrawing && this.currentTool !== 'polygon') return;

        const pos = this.getMousePos(e);
        this.currentX = pos.x;
        this.currentY = pos.y;

        if (this.currentTool === 'free') {
            // Hanya free drawing yang menggambar saat mouse move
            this.ctx.lineTo(pos.x, pos.y);
            this.ctx.stroke();
        } else if (['smooth', 'fast', 'circle', 'ellipse', 'triangle', 'square', 'rectangle'].includes(this.currentTool)) {
            // Semua tool lain menggunakan preview
            this.drawPreview();
        }
    }

    drawPreview() {
        // Restore canvas to state before preview
        if (this.previewState) {
            const img = new Image();
            img.onload = () => {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.ctx.drawImage(img, 0, 0);
                this.drawPreviewShape();
            };
            img.src = this.previewState;
        } else {
            this.drawPreviewShape();
        }
    }
    
    drawPreviewShape() {
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.lineWidth;
        
        const width = this.currentX - this.startX;
        const height = this.currentY - this.startY;
        
        switch (this.currentTool) {
            case 'smooth':
                // Garis lurus halus
                this.ctx.beginPath();
                this.ctx.moveTo(this.startX, this.startY);
                this.ctx.lineTo(this.currentX, this.currentY);
                this.ctx.stroke();
                break;
                
            case 'fast':
                // Garis lurus dengan snap ke 45 derajat
                let snapX = this.currentX;
                let snapY = this.currentY;
                
                const dx = this.currentX - this.startX;
                const dy = this.currentY - this.startY;
                const absDx = Math.abs(dx);
                const absDy = Math.abs(dy);
                
                // Snap ke horizontal, vertikal, atau diagonal 45°
                if (absDx > absDy * 2) {
                    // Horizontal
                    snapY = this.startY;
                } else if (absDy > absDx * 2) {
                    // Vertikal
                    snapX = this.startX;
                } else {
                    // Diagonal 45°
                    const diagonal = Math.max(absDx, absDy);
                    snapX = this.startX + (dx > 0 ? diagonal : -diagonal);
                    snapY = this.startY + (dy > 0 ? diagonal : -diagonal);
                }
                
                this.ctx.beginPath();
                this.ctx.moveTo(this.startX, this.startY);
                this.ctx.lineTo(snapX, snapY);
                this.ctx.stroke();
                
                // Update current position untuk final drawing
                this.snapX = snapX;
                this.snapY = snapY;
                break;
                
            case 'circle':
                const radius = Math.sqrt(width * width + height * height);
                this.ctx.beginPath();
                this.ctx.arc(this.startX, this.startY, radius, 0, 2 * Math.PI);
                this.ctx.stroke();
                break;
                
            case 'ellipse':
                this.ctx.beginPath();
                this.ctx.ellipse(this.startX + width/2, this.startY + height/2, 
                               Math.abs(width)/2, Math.abs(height)/2, 0, 0, 2 * Math.PI);
                this.ctx.stroke();
                break;
                
            case 'square':
                const size = Math.max(Math.abs(width), Math.abs(height));
                this.ctx.strokeRect(this.startX, this.startY, 
                                   width > 0 ? size : -size, 
                                   height > 0 ? size : -size);
                break;
                
            case 'rectangle':
                this.ctx.strokeRect(this.startX, this.startY, width, height);
                break;
                
            case 'triangle':
                this.ctx.beginPath();
                this.ctx.moveTo(this.startX, this.startY);
                this.ctx.lineTo(this.currentX, this.currentY);
                this.ctx.lineTo(this.startX - width, this.currentY);
                this.ctx.closePath();
                this.ctx.stroke();
                break;
        }
    }

    stopDrawing(e) {
        if (!this.isDrawing) return;
        
        this.isDrawing = false;
        this.previewState = null; // Clear preview state
        
        if (this.currentTool === 'free') {
            // Free drawing langsung selesai
            this.saveState();
        } else {
            // Semua tool lain perlu final drawing
            if (this.historyStep >= 0) {
                const img = new Image();
                img.onload = () => {
                    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                    this.ctx.drawImage(img, 0, 0);
                    this.drawFinalShape();
                    this.saveState();
                };
                img.src = this.history[this.historyStep];
            } else {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.drawFinalShape();
                this.saveState();
            }
        }
    }

    drawFinalShape() {
        const width = this.currentX - this.startX;
        const height = this.currentY - this.startY;
        
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.lineWidth;
        
        switch (this.currentTool) {
            case 'smooth':
                this.ctx.beginPath();
                this.ctx.moveTo(this.startX, this.startY);
                this.ctx.lineTo(this.currentX, this.currentY);
                this.ctx.stroke();
                break;
                
            case 'fast':
                this.ctx.beginPath();
                this.ctx.moveTo(this.startX, this.startY);
                this.ctx.lineTo(this.snapX || this.currentX, this.snapY || this.currentY);
                this.ctx.stroke();
                break;
                
            case 'circle':
                const radius = Math.sqrt(width * width + height * height);
                this.ctx.beginPath();
                this.ctx.arc(this.startX, this.startY, radius, 0, 2 * Math.PI);
                this.ctx.stroke();
                break;
                
            case 'ellipse':
                this.ctx.beginPath();
                this.ctx.ellipse(this.startX + width/2, this.startY + height/2, 
                               Math.abs(width)/2, Math.abs(height)/2, 0, 0, 2 * Math.PI);
                this.ctx.stroke();
                break;
                
            case 'square':
                const size = Math.max(Math.abs(width), Math.abs(height));
                this.ctx.strokeRect(this.startX, this.startY, 
                                   width > 0 ? size : -size, 
                                   height > 0 ? size : -size);
                break;
                
            case 'rectangle':
                this.ctx.strokeRect(this.startX, this.startY, width, height);
                break;
                
            case 'triangle':
                const triangle = {
                    p1: {x: this.startX, y: this.startY},
                    p2: {x: this.currentX, y: this.currentY},
                    p3: {x: this.startX - width, y: this.currentY}
                };
                
                this.ctx.beginPath();
                this.ctx.moveTo(triangle.p1.x, triangle.p1.y);
                this.ctx.lineTo(triangle.p2.x, triangle.p2.y);
                this.ctx.lineTo(triangle.p3.x, triangle.p3.y);
                this.ctx.closePath();
                this.ctx.stroke();
                
                // Store triangle for transformation
                this.triangle = triangle;
                break;
        }
    }

   resetFillMode() {
    this.isFillMode = false;
    this.currentTool = 'smooth';
    this.canvas.style.cursor = 'default';
    
    // Reset radio button ke smooth
    const smoothRadio = document.getElementById('option1');
    if (smoothRadio) {
        smoothRadio.checked = true;
    }
}

    handleClick(e) {
    // Jika dalam mode fill, lakukan fill
    if (this.isFillMode) {
        e.preventDefault();
        e.stopPropagation();
        
        const pos = this.getMousePos(e);
        const x = Math.floor(pos.x);
        const y = Math.floor(pos.y);
        
        console.log('Fill clicked at:', x, y);
        
        // Pastikan koordinat dalam bounds
        if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) {
            console.log('Click outside canvas bounds');
            this.resetFillMode();
            return;
        }
        
        this.performFloodFill(x, y);
        this.resetFillMode();
        return;
    }
    
    // Logika polygon yang sudah ada
    if (this.currentTool === 'polygon') {
        const pos = this.getMousePos(e);
        this.polygonPoints.push(pos);
        
        if (this.polygonPoints.length > 1) {
            this.ctx.strokeStyle = this.currentColor;
            this.ctx.lineWidth = this.lineWidth;
            this.ctx.beginPath();
            this.ctx.moveTo(this.polygonPoints[this.polygonPoints.length - 2].x, 
                           this.polygonPoints[this.polygonPoints.length - 2].y);
            this.ctx.lineTo(pos.x, pos.y);
            this.ctx.stroke();
        }
        
        // Draw point
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, 3, 0, 2 * Math.PI);
        this.ctx.fill();
    }
}


    finishPolygon(e) {
        if (this.currentTool === 'polygon' && this.polygonPoints.length > 2) {
            // Close polygon
            this.ctx.strokeStyle = this.currentColor;
            this.ctx.lineWidth = this.lineWidth;
            this.ctx.beginPath();
            this.ctx.moveTo(this.polygonPoints[this.polygonPoints.length - 1].x, 
                           this.polygonPoints[this.polygonPoints.length - 1].y);
            this.ctx.lineTo(this.polygonPoints[0].x, this.polygonPoints[0].y);
            this.ctx.stroke();
            
            this.polygonPoints = [];
            this.saveState();
        }
    }

    // Transformation methods
    transform(type) {
        if (!this.triangle) {
            alert('Gambar segitiga terlebih dahulu!');
            return;
        }

        const x = parseFloat(document.getElementById('input1').value) || 0;
        const y = parseFloat(document.getElementById('input2').value) || 0;
        
        // Clear canvas completely
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Apply transformation and draw only the transformed triangle
        this.applyTransformation(type, x, y);
    }

    applyTransformation(type, x, y) {
        let newTriangle = JSON.parse(JSON.stringify(this.triangle));
        
        switch (type) {
            case 'translate':
                if (x === 0 && y === 0) {
                    alert('Masukkan nilai X dan Y untuk translasi!');
                    return;
                }
                newTriangle.p1.x += x;
                newTriangle.p1.y += y;
                newTriangle.p2.x += x;
                newTriangle.p2.y += y;
                newTriangle.p3.x += x;
                newTriangle.p3.y += y;
                break;
                
            case 'scale':
                const scaleX = x || 1;
                const scaleY = y || scaleX; // Jika Y kosong, gunakan nilai X
                
                if (scaleX === 0 || scaleY === 0) {
                    alert('Nilai scale tidak boleh 0!');
                    return;
                }
                
                const centerX = (newTriangle.p1.x + newTriangle.p2.x + newTriangle.p3.x) / 3;
                const centerY = (newTriangle.p1.y + newTriangle.p2.y + newTriangle.p3.y) / 3;
                
                newTriangle.p1.x = centerX + (newTriangle.p1.x - centerX) * scaleX;
                newTriangle.p1.y = centerY + (newTriangle.p1.y - centerY) * scaleY;
                newTriangle.p2.x = centerX + (newTriangle.p2.x - centerX) * scaleX;
                newTriangle.p2.y = centerY + (newTriangle.p2.y - centerY) * scaleY;
                newTriangle.p3.x = centerX + (newTriangle.p3.x - centerX) * scaleX;
                newTriangle.p3.y = centerY + (newTriangle.p3.y - centerY) * scaleY;
                break;
                
            case 'rotate':
                const angle = (x || 0) * Math.PI / 180;
                if (angle === 0) {
                    alert('Masukkan nilai derajat untuk rotasi!');
                    return;
                }
                
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const cx = (newTriangle.p1.x + newTriangle.p2.x + newTriangle.p3.x) / 3;
                const cy = (newTriangle.p1.y + newTriangle.p2.y + newTriangle.p3.y) / 3;
                
                [newTriangle.p1, newTriangle.p2, newTriangle.p3].forEach(point => {
                    const dx = point.x - cx;
                    const dy = point.y - cy;
                    point.x = cx + dx * cos - dy * sin;
                    point.y = cy + dx * sin + dy * cos;
                });
                break;
                
            case 'flipH':
                const midX = (newTriangle.p1.x + newTriangle.p2.x + newTriangle.p3.x) / 3;
                newTriangle.p1.x = 2 * midX - newTriangle.p1.x;
                newTriangle.p2.x = 2 * midX - newTriangle.p2.x;
                newTriangle.p3.x = 2 * midX - newTriangle.p3.x;
                break;
                
            case 'flipV':
                const midY = (newTriangle.p1.y + newTriangle.p2.y + newTriangle.p3.y) / 3;
                newTriangle.p1.y = 2 * midY - newTriangle.p1.y;
                newTriangle.p2.y = 2 * midY - newTriangle.p2.y;
                newTriangle.p3.y = 2 * midY - newTriangle.p3.y;
                break;
                
            case 'shear':
                const shearX = x || 0;
                const shearY = y || 0;
                
                if (shearX === 0 && shearY === 0) {
                    alert('Masukkan nilai X atau Y untuk shear!');
                    return;
                }
                
                // Shear X (geser horizontal berdasarkan Y)
                if (shearX !== 0) {
                    newTriangle.p1.x += newTriangle.p1.y * shearX * 0.01;
                    newTriangle.p2.x += newTriangle.p2.y * shearX * 0.01;
                    newTriangle.p3.x += newTriangle.p3.y * shearX * 0.01;
                }
                
                // Shear Y (geser vertikal berdasarkan X)
                if (shearY !== 0) {
                    newTriangle.p1.y += newTriangle.p1.x * shearY * 0.01;
                    newTriangle.p2.y += newTriangle.p2.x * shearY * 0.01;
                    newTriangle.p3.y += newTriangle.p3.x * shearY * 0.01;
                }
                break;
        }
        
        // Draw the transformed triangle
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.lineWidth = this.lineWidth;
        this.ctx.beginPath();
        this.ctx.moveTo(newTriangle.p1.x, newTriangle.p1.y);
        this.ctx.lineTo(newTriangle.p2.x, newTriangle.p2.y);
        this.ctx.lineTo(newTriangle.p3.x, newTriangle.p3.y);
        this.ctx.closePath();
        this.ctx.stroke();
        
        // Update triangle reference
        this.triangle = newTriangle;
        this.saveState();
    }

    // Utility methods
    updateColorPreview() {
        const colorPicker = document.getElementById('colorPicker');
        const colorPreview = document.getElementById('colorPreview');
        colorPreview.style.backgroundColor = colorPicker.value;
    }

    changeColor() {
        this.currentColor = document.getElementById('colorPicker').value;
        this.ctx.strokeStyle = this.currentColor;
        this.ctx.fillStyle = this.currentColor;
    }

    clearCanvas() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.triangle = null;
        this.polygonPoints = [];
        this.saveState();
    }

fillCanvas() {
    this.currentTool = 'fill';
    this.canvas.style.cursor = 'crosshair';
    this.isFillMode = true; // Flag untuk mode fill
    
    // Tambahkan pesan untuk user
    alert('Mode isi warna aktif! Klik pada area yang ingin diwarnai.');
}


   handleClick(e) {
    // Jika dalam mode fill, lakukan fill
    if (this.isFillMode) {
        e.preventDefault();
        e.stopPropagation();
        
        const pos = this.getMousePos(e);
        const x = Math.floor(pos.x);
        const y = Math.floor(pos.y);
        
        console.log('Fill mode: clicked at', x, y);
        
        // Pastikan koordinat dalam bounds
        if (x < 0 || x >= this.canvas.width || y < 0 || y >= this.canvas.height) {
            console.log('Click outside canvas bounds');
            this.resetFillMode();
            return;
        }
        
        // Lakukan flood fill
        const success = this.performFloodFill(x, y);
        
        if (success) {
            console.log('Fill successful - keeping result');
        } else {
            console.log('Fill failed or no change needed');
        }
        
        // Reset mode setelah fill
        this.resetFillMode();
        return;
    }
    
    // Logika polygon yang sudah ada
    if (this.currentTool === 'polygon') {
        const pos = this.getMousePos(e);
        this.polygonPoints.push(pos);
        
        if (this.polygonPoints.length > 1) {
            this.ctx.strokeStyle = this.currentColor;
            this.ctx.lineWidth = this.lineWidth;
            this.ctx.beginPath();
            this.ctx.moveTo(this.polygonPoints[this.polygonPoints.length - 2].x, 
                           this.polygonPoints[this.polygonPoints.length - 2].y);
            this.ctx.lineTo(pos.x, pos.y);
            this.ctx.stroke();
        }
        
        // Draw point
        this.ctx.beginPath();
        this.ctx.arc(pos.x, pos.y, 3, 0, 2 * Math.PI);
        this.ctx.fill();
    }
}

 performFloodFill(x, y) {
    try {
        console.log('Starting flood fill at:', x, y);
        
        // Get canvas image data
        const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        
        // Get target color (color to be replaced)
        const targetColor = this.getPixelColor(data, x, y, this.canvas.width);
        
        // Get fill color
        const fillColor = this.hexToRgb(this.currentColor);
        
        console.log('Target color:', targetColor);
        console.log('Fill color:', fillColor);
        
        // Don't fill if target color is same as fill color
        if (this.colorsMatch(targetColor, fillColor)) {
            console.log('Colors match - no fill needed');
            return false;
        }
        
        // Use optimized flood fill
        const pixelsFilled = this.floodFillOptimized(data, x, y, this.canvas.width, this.canvas.height, targetColor, fillColor);
        
        if (pixelsFilled > 0) {
            // Put modified image data back to canvas
            this.ctx.putImageData(imageData, 0, 0);
            
            // PENTING: Tunggu sebentar agar canvas ter-render, baru save state
            setTimeout(() => {
                this.saveState();
                console.log('Fill completed and saved, pixels filled:', pixelsFilled);
            }, 10);
            
            return true;
        } else {
            console.log('No pixels filled');
            return false;
        }
        
    } catch (error) {
        console.error('Fill error:', error);
        alert('Terjadi kesalahan saat mengisi warna. Coba lagi.');
        return false;
    }
}

    getPixelColor(data, x, y, width) {
        const index = (y * width + x) * 4;
        return {
            r: data[index],
            g: data[index + 1],
            b: data[index + 2],
            a: data[index + 3]
        };
    }

    setPixelColor(data, x, y, width, color) {
        const index = (y * width + x) * 4;
        data[index] = color.r;
        data[index + 1] = color.g;
        data[index + 2] = color.b;
        data[index + 3] = 255; // Full opacity
    }

 colorsMatch(color1, color2) {
    // Jika salah satu warna transparan, anggap berbeda
    if (color1.a === 0 || color2.a === 0) {
        return color1.a === color2.a;
    }
    
    return color1.r === color2.r && 
           color1.g === color2.g && 
           color1.b === color2.b;
}


floodFillOptimized(data, startX, startY, width, height, targetColor, fillColor) {
    const stack = [{x: startX, y: startY}];
    const visited = new Set();
    let pixelsFilled = 0;
    const maxPixels = width * height * 0.8; // Batasi maksimal 80% canvas
    
    console.log('Starting flood fill algorithm...');
    
    while (stack.length > 0 && pixelsFilled < maxPixels) {
        const {x, y} = stack.pop();
        
        // Check bounds
        if (x < 0 || x >= width || y < 0 || y >= height) {
            continue;
        }
        
        const key = `${x},${y}`;
        if (visited.has(key)) {
            continue;
        }
        
        // Get current pixel color
        const currentColor = this.getPixelColor(data, x, y, width);
        
        // If current color doesn't match target color, skip
        if (!this.colorsMatch(currentColor, targetColor)) {
            continue;
        }
        
        // Mark as visited and set new color
        visited.add(key);
        this.setPixelColor(data, x, y, width, fillColor);
        pixelsFilled++;
        
        // Add adjacent pixels to stack (4-connected)
        stack.push({x: x + 1, y: y});
        stack.push({x: x - 1, y: y});
        stack.push({x: x, y: y + 1});
        stack.push({x: x, y: y - 1});
    }
    
    if (pixelsFilled >= maxPixels) {
        console.warn('Fill stopped - too many pixels');
    }
    
    console.log('Flood fill algorithm completed, pixels filled:', pixelsFilled);
    return pixelsFilled;
}

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    saveState() {
        this.historyStep++;
        if (this.historyStep < this.history.length) {
            this.history.length = this.historyStep;
        }
        this.history.push(this.canvas.toDataURL());
    }

    undo() {
        if (this.historyStep > 0) {
            this.historyStep--;
            this.restoreState();
        }
    }

    redo() {
        if (this.historyStep < this.history.length - 1) {
            this.historyStep++;
            this.restoreState();
        }
    }

    restoreState() {
        const img = new Image();
        img.onload = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.drawImage(img, 0, 0);
        };
        img.src = this.history[this.historyStep];
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const paintApp = new PaintApp();
});

// Additional utility functions
function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
