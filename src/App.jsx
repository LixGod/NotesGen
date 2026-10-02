import React, { useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

import { Groq } from 'groq-sdk';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  FileText, 
  Upload, 
  Send, 
  Sparkles, 
  Trash2, 
  Plus, 
  AlertCircle,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import html2pdf from 'html2pdf.js';

const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const groq = new Groq({ apiKey: GROQ_API_KEY, dangerouslyAllowBrowser: true });

function App() {
  const [files, setFiles] = useState([]);
  const [extractedText, setExtractedText] = useState('');
  const [extractedImages, setExtractedImages] = useState([]);
  
  const [pastPapersFiles, setPastPapersFiles] = useState([]);
  const [pastPapersText, setPastPapersText] = useState('');
  
  const [qbFiles, setQbFiles] = useState([]);
  const [questions, setQuestions] = useState('');
  
  const [marks, setMarks] = useState('5');
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [result, setResult] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const handleFileUpload = async (e, type) => {
    const uploadedFiles = Array.from(e.target.files);
    if (uploadedFiles.length === 0) return;

    if (type === 'notes' && files.length + uploadedFiles.length > 3) {
      alert('Maximum 3 notes allowed.');
      return;
    }

    setExtracting(true);
    try {
      for (const file of uploadedFiles) {
        let text = '';
        let imgs = [];
        
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
          text = await extractTextFromPDF(file);
        } else if (file.name.endsWith('.pptx')) {
          const res = await extractTextFromPPTX(file);
          text = res.text;
          imgs = res.images;
        } else if (file.type.startsWith('text/') || file.name.endsWith('.txt')) {
          text = await file.text();
        }

        if (type === 'notes') {
          setFiles(prev => [...prev, file]);
          setExtractedText(prev => prev + '\n' + text);
          if (imgs.length > 0) setExtractedImages(prev => [...prev, ...imgs]);
        } else if (type === 'papers') {
          setPastPapersFiles(prev => [...prev, file]);
          setPastPapersText(prev => prev + '\n' + text);
        } else if (type === 'qb') {
          setQbFiles(prev => [...prev, file]);
          setQuestions(prev => prev + '\n' + text);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setExtracting(false);
    }
  };

  const extractTextFromPDF = async (file) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      let fullText = '';
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const strings = content.items.map(item => item.str);
        fullText += strings.join(' ') + '\n';
      }
      return fullText;
    } catch (err) {
      console.error('PDF JS Error:', err);
      throw err;
    }
  };

  const extractTextFromPPTX = async (file) => {
    const arrayBuffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(arrayBuffer);
    let fullText = '';
    let images = [];
    
    // PPTX stores slides in ppt/slides/
    const slideFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/slides/slide') && name.endsWith('.xml'));
    
    for (const slideFile of slideFiles) {
      const xmlText = await zip.file(slideFile).async('text');
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, 'application/xml');
      const texts = xmlDoc.getElementsByTagName('a:t');
      for (let i = 0; i < texts.length; i++) {
        fullText += texts[i].textContent + ' ';
      }
      fullText += '\n';
    }

    // Extract images from ppt/media/
    const mediaFiles = Object.keys(zip.files).filter(name => name.startsWith('ppt/media/'));
    for (const mediaFile of mediaFiles) {
      const extension = mediaFile.split('.').pop().toLowerCase();
      if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(extension)) {
        const base64 = await zip.file(mediaFile).async('base64');
        images.push(`data:image/${extension === 'svg' ? 'svg+xml' : extension};base64,${base64}`);
      }
    }

    return { text: fullText, images };
  };

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
    // Ideally re-extract all text, but for simplicity we'll just keep it for now
    // or clear and re-process.
  };

  const handleSubmit = async (targetMode) => {
    if (!extractedText.trim()) {
      alert('Please upload some notes first!');
      return;
    }

    setLoading(true);
    setResult('');

    try {
      let prompt = '';
      const noteContext = extractedText.substring(0, 140000).trim();
      const paperContext = pastPapersText.substring(0, 50000).trim();
      const originalMarks = parseInt(marks) || 5;
      const aiMarks = originalMarks + 2;
      const depthGuide = aiMarks <= 4 ? 'Concise' : aiMarks <= 7 ? 'Detailed' : 'Comprehensive';

      if (targetMode === 'answer') {
        prompt = `You are an expert academic tutor. 
1. USE NOTES FIRST: Extract every possible detail from the provided notes.
2. RESEARCH FALLBACK: If the notes are insufficient OR if the topic is entirely missing, you MUST use your own extensive academic knowledge to provide a COMPREHENSIVE, high-scoring answer.
3. LENGTH REQUIREMENT: Every answer MUST fulfill the depth required for ${aiMarks} MARKS. If the notes only have 2 lines but the question is for 10 marks, you MUST write 3-4 detailed paragraphs using your own research.
4. ATTRIBUTION: Mark any section sourced from your own knowledge with "(not found in notes)".
5. **MANDATORY TABLE RULE**: Any "Difference between" or "Comparison" MUST be a Markdown TABLE. You MUST leave a BLANK LINE before the table starts. The header row MUST have content in every cell (do not leave the first cell empty).
6. **CODE RULE**: If a question asks to "Write a program" or "Create an application", provide the COMPLETE, WORKING CODE.

--- NOTES ---
${noteContext}

--- QUESTIONS ---
${questions}

Now, provide highly detailed, marks-oriented answers for every question. Never say "Not covered" without providing a full answer from your own knowledge first.`;
      } else {
        prompt = `Generate a Super-Prediction report using "Concept of Relativity".
1. Start with TOP 3 V.V.I questions with full high-mark answers.
2. Provide 5-10 other probable questions with Probability Scores (🔥).
3. **MANDATORY TABLE RULE**: Any "Difference between" or "Comparison" MUST be a Markdown TABLE with a BLANK LINE before it.

--- NOTES ---
${noteContext}
--- PAST PAPERS ---
${paperContext}
--- QB ---
${questions}`;
      }

      const completion = await groq.chat.completions.create({
        messages: [{ role: 'user', content: prompt }],
        model: "llama-3.3-70b-versatile",
      });

      setResult(completion.choices[0]?.message?.content || '');
    } catch (error) {
      console.error(error);
      setResult(`⚠️ Error: Tokens exhausted or API limit hit.`);
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = () => {
    const element = document.getElementById('pdf-export-content');
    if (!element) return;
    
    // Create a temporary container with light mode styles for the PDF
    const printContainer = element.cloneNode(true);
    printContainer.style.padding = '20px';
    printContainer.style.color = '#000';
    printContainer.style.backgroundColor = '#fff';
    printContainer.style.width = '800px';
    
    // Ensure all text inside is visible (override dark mode colors)
    const allText = printContainer.querySelectorAll('*');
    allText.forEach(el => {
      el.style.color = '#000';
      if (el.tagName === 'TABLE' || el.tagName === 'TH' || el.tagName === 'TD') {
        el.style.borderColor = '#ccc';
        if (el.tagName === 'TH') el.style.backgroundColor = '#f3f4f6';
      }
    });

    const opt = {
      margin:       10,
      filename:     `NotesGen_Result_${new Date().getTime()}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
    };

    html2pdf().set(opt).from(printContainer).save();
  };

  return (
    <div className="app-container">
      <header>
        <motion.h1 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          NotesGen AI
        </motion.h1>
        <p>Transform your study materials into structured answers and exam predictions.</p>
      </header>

      <div className="main-grid consolidated">
        <div className="left-panel">
          {/* Notes Section */}
          <section className="card glass">
            <h3><FileText size={20} color="var(--accent-primary)" /> 1. Study Notes (Max 3)</h3>
            <div className="upload-zone compact" onClick={() => document.getElementById('notes-input').click()}>
              <Upload size={24} />
              <p>Upload PDFs/PPTX</p>
              <input id="notes-input" type="file" multiple accept=".pdf,.pptx" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, 'notes')} />
            </div>
            <div className="file-chips">
              {files.map((f, i) => (
                <div key={i} className="chip">{f.name} <Trash2 size={12} onClick={() => setFiles(files.filter((_, idx) => idx !== i))} /></div>
              ))}
            </div>
          </section>

          {/* Question Bank Section */}
          <section className="card glass">
            <h3><Sparkles size={20} color="var(--accent-secondary)" /> 2. Question Bank</h3>
            <textarea 
              placeholder="Paste questions here..." 
              value={questions} 
              onChange={(e) => setQuestions(e.target.value)}
              rows={6}
              style={{ marginTop: '0.5rem' }}
            />
          </section>

          {/* Past Papers Section */}
          <section className="card glass">
            <h3><Clock size={20} color="#10b981" /> 3. Past Question Papers</h3>
            <div className="upload-zone compact" onClick={() => document.getElementById('qp-input').click()}>
              <Upload size={24} />
              <p>Upload PDFs/Images or paste below</p>
              <input id="qp-input" type="file" multiple accept=".pdf,.jpg,.png" style={{ display: 'none' }} onChange={(e) => handleFileUpload(e, 'papers')} />
            </div>
            <textarea 
              placeholder="Paste past paper questions here..." 
              value={pastPapersText} 
              onChange={(e) => setPastPapersText(e.target.value)}
              rows={4}
              style={{ marginTop: '1rem' }}
            />
            <div className="file-chips">
              {pastPapersFiles.map((f, i) => (
                <div key={i} className="chip">{f.name} <Trash2 size={12} onClick={() => setPastPapersFiles(pastPapersFiles.filter((_, idx) => idx !== i))} /></div>
              ))}
            </div>
          </section>

          <section className="card glass actions">
            <div className="input-group">
              <label>Target Marks per Question</label>
              <input type="number" value={marks} onChange={(e) => setMarks(e.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button className="btn btn-primary" onClick={() => handleSubmit('answer')} disabled={loading}>
                <Send size={18} /> Solve QB
              </button>
              <button className="btn btn-secondary" onClick={() => handleSubmit('predict')} disabled={loading}>
                <Sparkles size={18} /> Predict Questions
              </button>
            </div>
          </section>
        </div>

        <div className="right-panel">
          <section className="card glass results-area">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2><Sparkles size={24} color="var(--accent-primary)" /> AI Results</h2>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {result && (
                  <button 
                    onClick={downloadPDF}
                    className="btn-secondary"
                    style={{ 
                      padding: '0.4rem 0.8rem', 
                      fontSize: '0.8rem', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.4rem',
                      background: 'rgba(59, 130, 246, 0.1)',
                      color: 'var(--accent-primary)',
                      border: '1px solid var(--accent-primary)',
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    <Upload size={14} style={{ transform: 'rotate(180deg)' }} /> Download PDF
                  </button>
                )}
                {result && <span className="badge badge-blue">Generated</span>}
              </div>
            </div>
            
            {loading ? (
              <div className="loader">
                <div className="spinner"></div>
                <p style={{ color: 'var(--text-dim)' }}>AI is analyzing your notes...</p>
              </div>
            ) : result ? (
              <div className="results-container" id="pdf-export-content">
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="markdown-content"
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
                </motion.div>

                {extractedImages.length > 0 && (
                  <div className="media-gallery" style={{ marginTop: '2rem', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem' }}>
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                      <FileText size={20} color="var(--accent-secondary)" /> Extracted Media (Visual Context)
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
                      {extractedImages.slice(0, 10).map((src, i) => (
                        <div key={i} className="media-item glass" style={{ padding: '0.5rem', borderRadius: '8px', overflow: 'hidden' }}>
                          <img src={src} alt={`Extracted ${i}`} style={{ width: '100%', height: '100px', objectFit: 'cover', borderRadius: '4px' }} />
                        </div>
                      ))}
                    </div>
                    {extractedImages.length > 10 && (
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginTop: '0.5rem' }}>+ {extractedImages.length - 10} more images extracted</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="loader" style={{ opacity: 0.5 }}>
                <AlertCircle size={48} color="var(--border-color)" />
                <p>Upload notes and click generate to see results</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

export default App;
