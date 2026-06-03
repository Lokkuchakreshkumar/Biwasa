'use client';

import React, { useState, useEffect, useRef } from 'react';
import { jsPDF } from "jspdf";

export default function MangaMakerDashboard() {
  // ─── State Management ──────────────────────────────────────────────────────
  const [groqKey, setGroqKey] = useState('');
  const [chromeProfile, setChromeProfile] = useState('');

  const [scraplingStatus, setScraplingStatus] = useState('checking'); // 'checking' | 'available' | 'unavailable'
  const [scraplingVersion, setScraplingVersion] = useState('');

  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

  // Form Fields & Constant Defaults
  const [pagesCount, setPagesCount] = useState(5);
  const [textModel, setTextModel] = useState('llama-3.3-70b-versatile');
  const [storyIdea, setStoryIdea] = useState('');
  
  // Constant Defaults to keep Groq elaborator optimized
  const dialogues = "";
  const imageModel = 'dall-e-3';
  const imageSize = '1024x1792';
  const imageQuality = 'standard';
  const artStyle = 'highly detailed, black and white manga page, screentones, cinematic lighting';
  const charReferences = '';

  // Storyboard and Progress
  const [currentDraft, setCurrentDraft] = useState(null);
  const [statusMsg, setStatusMsg] = useState('Waiting for input...');
  const [statusTone, setStatusTone] = useState('neutral'); // 'neutral' | 'success' | 'error'
  const [isDrafting, setIsDrafting] = useState(false);
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);

  // Progress Bar
  const [progressVisible, setProgressVisible] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressText, setProgressText] = useState('');

  // Reader Mode Modal
  const [readerOpen, setReaderOpen] = useState(false);
  const [readerIndex, setReaderIndex] = useState(0);

  // Reference for card generation buttons
  const [generatingPageIds, setGeneratingPageIds] = useState({}); // tracking manual generation on single page cards

  // Inline Editable Prompts State
  const [editingPromptIndex, setEditingPromptIndex] = useState(null);
  const [tempPromptText, setTempPromptText] = useState('');

  // ─── Effects & Initializations ─────────────────────────────────────────────
  useEffect(() => {
    // 1. Check Python Modules Status (Scrapling check backend)
    async function checkModules() {
      try {
        const res = await fetch('/api/check-scrapling');
        const data = await res.json();
        if (res.ok && data.available) {
          setScraplingStatus('available');
          setScraplingVersion(data.version);
        } else {
          setScraplingStatus('unavailable');
        }
      } catch (err) {
        setScraplingStatus('unavailable');
      }
    }
    checkModules();

    // 2. Load env config keys
    async function loadConfig() {
      try {
        const res = await fetch('/api/config');
        const data = await res.json();
        if (res.ok) {
          if (data.groqApiKey) setGroqKey(data.groqApiKey);
          if (data.chromeProfile) setChromeProfile(data.chromeProfile);
        }
      } catch (err) {
        console.error('Failed to load API keys config:', err);
      }
    }
    loadConfig();

    // 3. Load active storyboard draft from localStorage
    try {
      const saved = localStorage.getItem('mangaMaker_active_draft');
      if (saved) {
        const draft = JSON.parse(saved);
        if (draft && draft.pages && draft.pages.length > 0) {
          setCurrentDraft(draft);
        }
      }
    } catch (e) {
      console.error('Failed to restore active draft:', e);
    }

    // 4. Load onboarding banner preference
    if (localStorage.getItem('mangaMaker_onboarding_dismissed') === 'true') {
      setOnboardingDismissed(true);
    }
  }, []);

  // Save active draft whenever it modifies
  useEffect(() => {
    if (currentDraft) {
      localStorage.setItem('mangaMaker_active_draft', JSON.stringify(currentDraft));
    }
  }, [currentDraft]);

  // Keyboard navigation for reader modal
  useEffect(() => {
    function handleKeyDown(e) {
      if (!readerOpen || !currentDraft?.pages) return;
      if (e.key === 'Escape') {
        setReaderOpen(false);
      } else if (e.key === 'ArrowLeft') {
        if (readerIndex > 0) setReaderIndex(prev => prev - 1);
      } else if (e.key === 'ArrowRight') {
        if (readerIndex < currentDraft.pages.length - 1) setReaderIndex(prev => prev + 1);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [readerOpen, readerIndex, currentDraft]);

  // ─── Action Handlers ────────────────────────────────────────────────────────
  function triggerStatus(msg, tone = 'neutral') {
    setStatusMsg(msg);
    setStatusTone(tone);
  }

  function handleDismissOnboarding() {
    setOnboardingDismissed(true);
    localStorage.setItem('mangaMaker_onboarding_dismissed', 'true');
  }

  async function handleSaveConfig() {
    triggerStatus('Saving config keys...', 'neutral');
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groqApiKey: groqKey, chromeProfile })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        triggerStatus('Keys saved successfully to local .env file!', 'success');
      } else {
        throw new Error(data.error || 'Failed to save config.');
      }
    } catch (err) {
      triggerStatus(`Failed to save keys: ${err.message}`, 'error');
    }
  }

  async function handleDraftStoryboard(e) {
    e.preventDefault();
    if (!groqKey.trim()) {
      triggerStatus('Groq API Key is required to draft the storyboard outline.', 'error');
      return;
    }
    setIsDrafting(true);
    triggerStatus(`Asking Groq to elaborate ${pagesCount} manga pages...`, 'neutral');

    try {
      const res = await fetch('/api/elaborate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groqApiKey: groqKey,
          pages: pagesCount,
          model: textModel,
          story: storyIdea,
          dialogues: dialogues,
          imageStyle: artStyle,
          references: charReferences
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Could not elaborate storyboard.');
      }

      setCurrentDraft(data);
      triggerStatus(`Successfully drafted "${data.title || 'MangaStoryboard'}".`, 'success');
    } catch (err) {
      triggerStatus(err.message, 'error');
    } finally {
      setIsDrafting(false);
    }
  }

  // Generate individual panel image using ChatGPT Free (Scraper)
  async function generateImage(page) {
    const res = await fetch('/api/scrape-chatgpt', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: page.image_prompt,
        page: page.page,
        title: currentDraft?.title || 'manga-maker',
        chromeProfile: chromeProfile
      })
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || `ChatGPT Scraper pipeline failed for page ${page.page}`);
    }
    return data;
  }

  async function handleGenerateSingleImage(index) {
    const page = currentDraft.pages[index];
    setGeneratingPageIds(prev => ({ ...prev, [page.page]: true }));
    triggerStatus(`Generating image for page ${page.page}...`, 'neutral');

    try {
      const result = await generateImage(page);

      setCurrentDraft(prev => {
        if (!prev || !prev.pages) return prev;
        const updatedPages = [...prev.pages];
        updatedPages[index] = {
          ...updatedPages[index],
          generated_image_url: result.image_url,
          generated_image_meta: {
            model: result.image_model || 'chatgpt-scraper',
            size: result.size || 'auto',
            quality: result.quality || 'auto'
          }
        };
        return { ...prev, pages: updatedPages };
      });
      triggerStatus(`Generated image for page ${page.page}.`, 'success');
    } catch (err) {
      triggerStatus(err.message, 'error');
    } finally {
      setGeneratingPageIds(prev => ({ ...prev, [page.page]: false }));
    }
  }

  // Generate all panel images in bulk
  async function handleGenerateAllImages() {
    if (!currentDraft?.pages?.length) return;
    const pages = currentDraft.pages;
    setIsBulkGenerating(true);
    setProgressVisible(true);
    setProgressPercent(0);
    setProgressText(`Starting panel image bulk generation for ${pages.length} panels...`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      const pageNum = page.page;

      setProgressText(`Generating panel ${pageNum} of ${pages.length}...`);
      const currentPct = Math.round((i / pages.length) * 100);
      setProgressPercent(currentPct);
      setGeneratingPageIds(prev => ({ ...prev, [pageNum]: true }));

      try {
        const result = await generateImage(page);
        
        setCurrentDraft(prev => {
          if (!prev || !prev.pages) return prev;
          const updatedPages = [...prev.pages];
          updatedPages[i] = {
            ...updatedPages[i],
            generated_image_url: result.image_url,
            generated_image_meta: {
              model: result.image_model || 'chatgpt-scraper',
              size: result.size || 'auto',
              quality: result.quality || 'auto'
            }
          };
          return { ...prev, pages: updatedPages };
        });
        
        successCount++;
        // Small delay to allow Next.js dev server to serve the newly generated image
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (err) {
        console.error(`Page ${pageNum} bulk generation failed:`, err);
        failCount++;
      } finally {
        setGeneratingPageIds(prev => ({ ...prev, [pageNum]: false }));
      }
    }
    setProgressPercent(100);
    setProgressText(`Completed! ${successCount} panels generated successfully. ${failCount} failed.`);
    triggerStatus(`Completed bulk generation. ${successCount} successfully drawn, ${failCount} failed.`, 'success');

    setIsBulkGenerating(false);
    setTimeout(() => {
      setProgressVisible(false);
    }, 6000);
  }

  // Copy JSON storyboard
  async function handleCopyJson() {
    if (!currentDraft) return;
    await navigator.clipboard.writeText(JSON.stringify(currentDraft, null, 2));
    triggerStatus('Copied full manga storyboard JSON to clipboard.', 'success');
  }

  // Download JSON file
  function handleDownloadJson() {
    if (!currentDraft) return;
    const blob = new Blob([JSON.stringify(currentDraft, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${(currentDraft.title || 'manga-maker').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    triggerStatus('Downloaded manga storyboard JSON.', 'success');
  }

  // Download Manga as PDF
  async function handleDownloadMangaPdf() {
    if (!currentDraft?.pages?.length) return;
    const pagesWithImages = currentDraft.pages.filter(p => p.generated_image_url);
    if (pagesWithImages.length === 0) {
      triggerStatus('No images generated yet to download as PDF.', 'error');
      return;
    }
    
    triggerStatus('Generating Manga PDF...', 'neutral');
    try {
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      for (let i = 0; i < pagesWithImages.length; i++) {
        if (i > 0) pdf.addPage();
        
        const page = pagesWithImages[i];
        const imgUrl = page.generated_image_url;
        let imgData = imgUrl;

        // Fetch image to data URL if it's not already one
        if (!imgUrl.startsWith('data:')) {
          const res = await fetch(imgUrl);
          const blob = await res.blob();
          imgData = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(blob);
          });
        }

        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
        
        let finalHeight = pdfHeight;
        let finalWidth = pdfWidth;
        let xOffset = 0;
        let yOffset = 0;

        // If height is larger than page, scale by height
        if (pdfHeight > pdf.internal.pageSize.getHeight()) {
          finalHeight = pdf.internal.pageSize.getHeight();
          finalWidth = (imgProps.width * finalHeight) / imgProps.height;
          xOffset = (pdfWidth - finalWidth) / 2;
        } else {
          // Center vertically
          yOffset = (pdf.internal.pageSize.getHeight() - finalHeight) / 2;
        }

        pdf.addImage(imgData, undefined, xOffset, yOffset, finalWidth, finalHeight);
      }

      pdf.save(`${(currentDraft.title || 'manga-maker').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`);
      triggerStatus('Manga PDF downloaded successfully!', 'success');
    } catch (error) {
      triggerStatus(`Failed to generate PDF: ${error.message}`, 'error');
    }
  }

  // Direct edit prompt functions
  function handleStartEditPrompt(index, currentVal) {
    setEditingPromptIndex(index);
    setTempPromptText(currentVal);
  }

  function handleSaveEditPrompt(index) {
    if (editingPromptIndex === null) return;
    const updatedPages = [...currentDraft.pages];
    updatedPages[index] = {
      ...updatedPages[index],
      image_prompt: tempPromptText.trim()
    };
    setCurrentDraft({ ...currentDraft, pages: updatedPages });
    setEditingPromptIndex(null);
    triggerStatus(`Updated image prompt for Page ${updatedPages[index].page}.`, 'success');
  }

  // Direct manual image URL changes
  function handleImageUrlChange(index, value) {
    const updatedPages = [...currentDraft.pages];
    updatedPages[index] = {
      ...updatedPages[index],
      generated_image_url: value.trim()
    };
    setCurrentDraft({ ...currentDraft, pages: updatedPages });
  }

  function normalizeDialogues(dialoguesVal) {
    if (Array.isArray(dialoguesVal)) return dialoguesVal;
    if (typeof dialoguesVal === 'string' && dialoguesVal.trim()) {
      return dialoguesVal.split(/\n+/).map((line) => line.trim());
    }
    return ['No dialogue on this page.'];
  }

  // ─── Rendering Helpers ─────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col overflow-hidden font-sans">

      {/* 1. Onboarding Banner (Minimalist Stark Editorial) */}
      {!onboardingDismissed && (
        <div id="onboarding-banner" className="bg-stone-900 text-stone-200 p-3 flex justify-between items-center shadow-md transition-all shrink-0 border-b border-stone-800">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-stone-300" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"></path></svg>
            <span className="text-sm font-medium">Welcome to the Next.js Manga Studio! Insert your API keys in the sidebar configuration and click Save to start drafting.</span>
          </div>
          <button onClick={handleDismissOnboarding} className="p-1 hover:bg-stone-800 rounded-full transition-colors focus:outline-none">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
        </div>
      )}

      {/* 2. Main Studio Panel */}
      <div className="flex-1 flex overflow-hidden">

        {/* Sidebar Configuration */}
        <aside className="w-80 glass-panel border-r border-white/5 flex flex-col overflow-y-auto hidden md:flex z-10 shrink-0">
          <div className="p-6 border-b border-white/5 flex flex-col gap-1">
            <h1 className="text-3xl font-black text-stone-100 tracking-tight outfit drop-shadow-[0_2px_4px_rgba(0,0,0,0.3)]">BIWASA</h1>
            <p className="text-[9px] uppercase tracking-[0.25em] font-bold text-stone-400">Production level Manga Creator</p>
          </div>

          <div className="p-6 space-y-8">
            {/* Configuration */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs uppercase tracking-widest text-slate-400 font-semibold outfit">Configuration</h2>
                <div className="flex items-center gap-1.5 bg-stone-900/60 px-2 py-0.5 rounded border border-stone-850">
                  <div
                    id="modules-status-dot"
                    className={`modules-badge ${scraplingStatus}`}
                    title={
                      scraplingStatus === 'checking' ? 'Validating environment...' :
                        scraplingStatus === 'available' ? 'Manga modules loaded successfully' : 'Modules Not Installed'
                    }
                  />
                  <span className="text-[9px] text-stone-300 font-mono font-semibold uppercase tracking-wider">
                    {scraplingStatus === 'checking' ? 'Checking' : scraplingStatus === 'available' ? 'Installed' : 'Missing'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Groq API Key</label>
                <input
                  type="password"
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  className="w-full glass-input rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none"
                  placeholder="gsk_..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1 mt-3">Chrome Profile Path (Optional)</label>
                <input
                  type="text"
                  value={chromeProfile}
                  onChange={(e) => setChromeProfile(e.target.value)}
                  className="w-full glass-input rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none"
                  placeholder="~/.config/google-chrome/Default"
                />
                <p className="text-[10px] text-slate-500 mt-1">Leave empty to use local default profile.</p>
              </div>

              <button
                onClick={handleSaveConfig}
                className="w-full py-2 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sm font-medium rounded-lg transition-colors mt-2 focus:outline-none"
              >
                Save Configuration
              </button>
            </div>

            <hr className="border-slate-700/50" />

            {/* Story Draft Form */}
            <form onSubmit={handleDraftStoryboard} className="space-y-5">
              <h2 className="text-xs uppercase tracking-widest text-slate-400 font-semibold mb-2 outfit">Draft Generation</h2>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Pages</label>
                  <input
                    type="number"
                    value={pagesCount}
                    onChange={(e) => setPagesCount(Math.max(1, Math.min(50, Number(e.target.value))))}
                    min="1"
                    max="50"
                    className="w-full glass-input rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Text Model</label>
                  <select
                    value={textModel}
                    onChange={(e) => setTextModel(e.target.value)}
                    className="w-full glass-input rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  >
                    <option value="llama-3.3-70b-versatile">Llama 3.3 70B</option>
                    <option value="llama-3.1-8b-instant">Llama 3.1 8B</option>
                    <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Story Idea</label>
                <textarea
                  value={storyIdea}
                  onChange={(e) => setStoryIdea(e.target.value)}
                  rows="6"
                  className="w-full glass-input rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none resize-none"
                  placeholder="A cyberpunk detective solves a murder in Neo-Tokyo..."
                />
              </div>

              {/* Stark Bone-White Action Button - Premium Outfit Geometric Style */}
              <button
                type="submit"
                disabled={isDrafting}
                className="w-full py-3.5 px-4 bg-stone-100 hover:bg-white text-stone-950 font-bold tracking-[0.06em] rounded-lg shadow-md border border-stone-200 transition-all transform active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none outfit uppercase text-xs"
              >
                {isDrafting ? 'Elaborating Storyboard...' : 'Draft Storyboard'}
              </button>
            </form>
          </div>
        </aside>

        {/* Main Canvas Area */}
        <main className="flex-1 flex flex-col relative overflow-hidden bg-transparent">

          {/* Header Action Bar */}
          <header className="glass-panel border-b border-white/5 px-8 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between z-10 shrink-0 gap-4">
            <div>
              <h2 className="text-xl font-bold text-white mb-1 outfit">
                {currentDraft?.title || 'No Draft Storyboard'}
              </h2>
              {currentDraft?.logline && (
                <div id="summary">
                  <p id="logline" className="text-sm text-slate-400 max-w-2xl truncate">
                    {currentDraft.logline}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <div
                className="text-sm mr-4 font-medium transition-colors duration-300"
                style={{
                  color: statusTone === 'success' ? '#faf8f5' : statusTone === 'error' ? '#ff3b30' : '#8e8e93'
                }}
              >
                {statusMsg}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleCopyJson}
                  disabled={!currentDraft}
                  className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none"
                  title="Copy JSON"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                </button>
                <button
                  onClick={handleDownloadJson}
                  disabled={!currentDraft}
                  className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none"
                  title="Download JSON"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                </button>
                <div className="w-px h-8 bg-white/10 mx-1 hidden sm:block"></div>
                {/* Vermillion Red Stamp CTA Button - Premium Solid Printed Aesthetic */}
                <button
                  onClick={handleGenerateAllImages}
                  disabled={!currentDraft?.pages?.length || isBulkGenerating}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-bold tracking-wide rounded-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-md border border-red-500 transition-all focus:outline-none whitespace-nowrap outfit uppercase"
                >
                  {isBulkGenerating ? 'Bulk drawing...' : 'Generate All Images'}
                </button>
                <button
                  onClick={() => { setReaderIndex(0); setReaderOpen(true); }}
                  disabled={!currentDraft?.pages?.length}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all focus:outline-none"
                >
                  Reader Mode
                </button>
                <button
                  onClick={handleDownloadMangaPdf}
                  disabled={!currentDraft?.pages?.length}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all focus:outline-none flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                  Download PDF
                </button>
                <button
                  onClick={() => window.print()}
                  disabled={!currentDraft?.pages?.length}
                  className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none"
                  title="Print to PDF"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                </button>
              </div>
            </div>
          </header>

          {/* 3. Global Bulk Progress Bar (Solid Warm Bone White) */}
          {progressVisible && (
            <div id="progress-bar-wrap" className="absolute top-[73px] left-0 right-0 h-1 bg-slate-800 z-20">
              <div
                id="progress-fill"
                className="h-full bg-stone-200 transition-all duration-300 ease-out shadow-sm"
                style={{ width: `${progressPercent}%` }}
              />
              <div className="absolute top-2 right-4 text-xs font-mono text-stone-300 flex items-center gap-2 bg-stone-900/90 px-3 py-1 rounded shadow-lg border border-stone-700">
                <span>{progressText}</span>
                <span className="font-bold text-white">{progressPercent}%</span>
              </div>
            </div>
          )}

          {/* 4. Canvas Storyboard Page Cards */}
          <div className="flex-1 overflow-y-auto p-8 relative scroll-smooth">
            <div id="pages-list" className="max-w-5xl mx-auto space-y-8 pb-20">

              {!currentDraft || !currentDraft.pages || currentDraft.pages.length === 0 ? (
                // Empty State
                <div className="text-center py-32 opacity-50" id="empty-state">
                  <svg className="w-16 h-16 mx-auto mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                  <h3 className="text-xl font-medium text-slate-300 outfit">Your Storyboard is Empty</h3>
                  <p className="text-sm mt-2">Input your story outline in the sidebar on the left and click "Draft Storyboard" to populate page cells.</p>
                </div>
              ) : (
                // Render Page Cards
                currentDraft.pages.map((page, index) => {
                  const isGenerating = !!generatingPageIds[page.page];
                  const isEditingPrompt = editingPromptIndex === index;

                  return (
                    <div
                      key={page.page}
                      className={`page-card rounded-2xl overflow-hidden flex flex-col md:flex-row group ${page.generated_image_url ? 'has-image' : ''}`}
                    >
                      {/* Text details column */}
                      <div className="flex-1 p-6 flex flex-col min-w-0 border-b md:border-b-0 md:border-r border-slate-700/50">
                        <div className="flex items-center justify-between mb-4">
                          <div className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-stone-800 text-stone-300 border border-stone-700/50 text-xs font-bold uppercase tracking-wider page-number">
                            Page {page.page}
                          </div>
                          <button
                            onClick={async () => {
                              await navigator.clipboard.writeText(page.image_prompt || '');
                              triggerStatus(`Copied image prompt for Page ${page.page}.`, 'success');
                            }}
                            className="copy-prompt p-1.5 text-slate-500 hover:text-stone-300 hover:bg-stone-800 rounded-md transition-colors focus:outline-none"
                            title="Copy Prompt"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                          </button>
                        </div>

                        <div className="space-y-6 flex-1">
                          <div>
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 outfit">Story Events</h4>
                            <p className="text-sm text-slate-300 leading-relaxed page-story">{page.story || 'No story details elaborated.'}</p>
                          </div>

                          <div>
                            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2 outfit">Dialogues</h4>
                            <ul className="text-sm text-slate-300 space-y-1 pl-4 list-disc marker:text-slate-600 page-dialogues">
                              {normalizeDialogues(page.dialogues_in_this_page).map((line, idx) => (
                                <li key={idx}>{line}</li>
                              ))}
                            </ul>
                          </div>

                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-widest outfit">Image Prompt</h4>
                              <button
                                onClick={() => {
                                  if (isEditingPrompt) {
                                    handleSaveEditPrompt(index);
                                  } else {
                                    handleStartEditPrompt(index, page.image_prompt || '');
                                  }
                                }}
                                className="edit-prompt-btn text-xs text-stone-300 hover:text-stone-100 font-medium focus:outline-none"
                              >
                                {isEditingPrompt ? 'Save' : 'Edit'}
                              </button>
                            </div>
                            <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 min-h-[60px] flex items-start">
                              {isEditingPrompt ? (
                                <textarea
                                  value={tempPromptText}
                                  onChange={(e) => setTempPromptText(e.target.value)}
                                  className="bg-transparent text-sm text-slate-300 font-mono focus:outline-none resize-y w-full min-h-[100px] border-0 p-0"
                                />
                              ) : (
                                <p
                                  onClick={() => handleStartEditPrompt(index, page.image_prompt || '')}
                                  className="text-sm text-slate-400 font-mono text-[13px] leading-relaxed cursor-pointer w-full hover:text-slate-300 transition-colors"
                                >
                                  {page.image_prompt || 'No prompt added yet.'}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Image panel preview column */}
                      <div className="w-full md:w-[400px] lg:w-[500px] flex flex-col bg-slate-900/20 shrink-0">
                        <div className="p-4 border-b border-slate-700/50 bg-slate-800/20">
                          <label className="block text-xs font-medium text-slate-400 mb-1">Generated Image URL</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={page.generated_image_url || ''}
                              onChange={(e) => handleImageUrlChange(index, e.target.value)}
                              className="image-url flex-1 glass-input rounded-lg px-3 py-1.5 text-sm text-white placeholder-slate-600 focus:outline-none"
                              placeholder="https://... or /generated/..."
                            />
                            {/* Solid Obsidian/Stone Button - Stark Printed Aesthetic */}
                            <button
                              onClick={() => handleGenerateSingleImage(index)}
                              disabled={isGenerating || isBulkGenerating}
                              className="generate-page-image px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-100 text-xs font-bold rounded-lg border border-stone-700 shadow-sm transition-all whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none outfit uppercase"
                            >
                              {isGenerating ? 'Drawing...' : 'Generate'}
                            </button>
                          </div>
                        </div>

                        <div className="flex-1 min-h-[400px] relative p-4 flex items-center justify-center">
                          {isGenerating ? (
                            <div className="preview loading w-full h-full rounded-lg border border-stone-750 flex flex-col items-center justify-center text-stone-400 text-sm bg-stone-950/40 relative overflow-hidden">
                              <div className="absolute inset-0 opacity-20 sketch-lines-bg"></div>
                              <div className="relative flex flex-col items-center gap-4 z-10">
                                <div className="w-12 h-12 relative flex items-center justify-center">
                                  <div className="absolute inset-0 rounded-full border-2 border-stone-850"></div>
                                  <div className="absolute inset-0 rounded-full border-2 border-t-stone-100 animate-spin"></div>
                                </div>
                                <div className="flex flex-col items-center gap-1 text-center">
                                  <span className="font-semibold text-xs uppercase tracking-[0.12em] text-stone-100 outfit">Inking Page {page.page}...</span>
                                  <span className="text-[10px] text-stone-500 font-mono tracking-wide">Drawing screentones & outlines</span>
                                </div>
                              </div>
                            </div>
                          ) : page.generated_image_url ? (
                            <div
                              onClick={() => { setReaderIndex(index); setReaderOpen(true); }}
                              className="preview w-full h-full rounded-lg flex items-center justify-center overflow-hidden cursor-pointer relative bg-slate-900/30 group/preview"
                            >
                              <img
                                src={page.generated_image_url}
                                alt={`Generated panel page ${page.page}`}
                                className="max-w-full max-h-full object-contain rounded-md transition-transform duration-300 group-hover/preview:scale-[1.02]"
                              />
                            </div>
                          ) : (
                            <div className="preview empty w-full h-full rounded-lg flex flex-col items-center justify-center text-slate-500 text-sm overflow-hidden relative cursor-pointer">
                              Image preview
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

            </div>
          </div>
        </main>
      </div>

      {/* 5. Reader Mode Modal */}
      {readerOpen && currentDraft?.pages && (
        <div id="reader-modal" className="fixed inset-0 z-50 flex flex-col bg-slate-950/98 backdrop-blur-sm transition-opacity duration-300">
          {/* Modal Header */}
          <div className="flex justify-between items-center p-4 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setReaderOpen(false)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors focus:outline-none"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
              </button>
              <h2 id="reader-title" className="text-lg font-semibold text-white outfit">
                {currentDraft.title || 'Manga Reader'}
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <span id="reader-counter" className="text-sm font-mono text-slate-400">
                Page {currentDraft.pages[readerIndex]?.page} of {currentDraft.pages.length}
              </span>
            </div>
          </div>

          {/* Modal Image Slider Canvas */}
          <div className="flex-1 flex items-center justify-center relative overflow-hidden p-4">
            <button
              onClick={() => setReaderIndex(prev => Math.max(0, prev - 1))}
              disabled={readerIndex === 0}
              className="absolute left-4 p-4 bg-slate-900/80 hover:bg-stone-100 hover:text-stone-950 text-white rounded-full backdrop-blur-md shadow-xl transition-all disabled:opacity-0 disabled:pointer-events-none z-10 focus:outline-none"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
            </button>

            <div id="reader-content" className="w-full h-full flex items-center justify-center">
              {currentDraft.pages[readerIndex]?.generated_image_url ? (
                <img
                  src={currentDraft.pages[readerIndex].generated_image_url}
                  alt={`Manga page ${currentDraft.pages[readerIndex].page}`}
                  className="max-w-full max-h-full object-contain rounded-md shadow-[0_10px_40px_rgba(0,0,0,0.6)]"
                />
              ) : (
                <div className="reader-no-image text-center max-w-md">
                  <h3 className="text-xl font-semibold text-slate-300 mb-2 outfit">No artwork drawn for Page {currentDraft.pages[readerIndex]?.page} yet.</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">Close this reader modal and trigger the "Generate" generator pipelines in the storyboard cards list first.</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setReaderIndex(prev => Math.min(currentDraft.pages.length - 1, prev + 1))}
              disabled={readerIndex === currentDraft.pages.length - 1}
              className="absolute right-4 p-4 bg-slate-900/80 hover:bg-stone-100 hover:text-stone-950 text-white rounded-full backdrop-blur-md shadow-xl transition-all disabled:opacity-0 disabled:pointer-events-none z-10 focus:outline-none"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
            </button>
          </div>

          {/* Navigation Dot Indicators */}
          <div id="reader-dots" className="p-4 flex justify-center gap-2 shrink-0">
            {currentDraft.pages.map((p, idx) => (
              <div
                key={p.page}
                onClick={() => setReaderIndex(idx)}
                className={`reader-dot ${idx === readerIndex ? 'active' : ''}`}
              />
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
