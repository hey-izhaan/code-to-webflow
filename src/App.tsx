import { useState, useCallback } from 'react'
import Editor from '@monaco-editor/react'
import { toast } from 'sonner'
import { Toaster } from '@/components/ui/sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { WebflowConverter } from '@/engine/converter'

// Hero Section / Header

const defaultHtml = `<section class="hero-container">
        <div class="hero-content">
            <h1>HTML to Webflow. Instantly. Izvento.</h1>
            
            <a href="#" class="btn-join">START CONVERTING</a>
            
            <div class="divider"></div>
            
            <p class="hero-subtext">
                Upload your HTML and get a Webflow-compatible structure.
            </p>
        </div>
    </section>`

const defaultCss = `.hero-container {
    min-height: 100vh;
    display: flex;
    align-items: center;
    padding: 10% 5%; /* Responsive padding */
}

.hero-content {
    max-width: 800px;
}

/* Typography */
h1 {
    font-size: clamp(2.5rem, 8vw, 5.5rem); /* Fluid typography */
    font-weight: 500;
    line-height: 1.05;
    letter-spacing: -0.02em;
    margin-bottom: 40px;
}

/* Button Styling */
.btn-join {
    display: inline-block;
    background-color: #111;
    color: #fff;
    text-decoration: none;
    padding: 14px 28px;
    border-radius: 50px; /* Pill shape */
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.1em;
    transition: transform 0.2s ease;
}

.btn-join:hover {
    transform: scale(1.05);
}

/* Bottom Section */
.divider {
    width: 100%;
    max-width: 400px; /* Matches the width of the bottom text */
    height: 1px;
    background-color: #e0e0e0;
    margin: 100px 0 20px 0;
}

.hero-subtext {
    font-size: 1.1rem;
    line-height: 1.5;
    color: #333;
}

/* Mobile Adjustments */
@media (max-width: 768px) {
    .hero-container {
        padding: 60px 20px;
        align-items: flex-start;
    }
    
    h1 {
        margin-bottom: 30px;
    }

    .divider {
        margin: 60px 0 20px 0;
    }
}`

function App() {
  const [html, setHtml] = useState(defaultHtml)
  const [css, setCss] = useState(defaultCss)
  const [isConverting, setIsConverting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  const handleConvertAndCopy = useCallback(async () => {
    if (!html.trim()) {
      toast.error('Empty Content', {
        description: 'Please enter some HTML code to convert.'
      })
      return
    }

    setIsConverting(true)

    try {
      const converter = new WebflowConverter()
      const result = converter.convert(html, css)
      const jsonOutput = JSON.stringify(result)

      // Use the clipboard data setter to specify application/json 
      // This ensures Webflow Designer recognizes it correctly
      const copyJson = (e: ClipboardEvent) => {
        e.preventDefault()
        if (e.clipboardData) {
          e.clipboardData.setData('application/json', jsonOutput)
          // Also set as text/plain just in case
          e.clipboardData.setData('text/plain', jsonOutput)
        }
      }

      document.addEventListener('copy', copyJson)
      document.execCommand('copy')
      document.removeEventListener('copy', copyJson)

      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 2000)

      toast.success('Ready to Paste!', {
        description: 'Webflow JSON copied with application/json metadata.'
      })
    } catch (error) {
      toast.error('Conversion Error', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred'
      })
    } finally {
      setIsConverting(false)
    }
  }, [html, css])

  return (
    <div className="min-h-screen bg-background selection:bg-primary/20">
      <Toaster position="top-center" richColors />

      {/* Hero Section / Header */}
      <header className="border-b border-border/40 glass sticky top-0 z-50 backdrop-blur-md">
        <div className="max-w-[1600px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground">Code to Webflow</h1>
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest opacity-70">Professional Bridge</p>
            </div>
          </div>

          <Button
            size="lg"
            onClick={handleConvertAndCopy}
            disabled={isConverting}
            className={`
              relative overflow-hidden h-12 px-8
              bg-primary text-white font-bold text-base
              shadow-[0_0_20px_rgba(var(--primary),0.3)]
              transition-all duration-500 ease-out
              active:scale-95
              ${showSuccess ? 'success-pop bg-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.3)]' : ''}
              ${!isConverting && !showSuccess ? 'pulse-glow' : ''}
            `}
          >
            {isConverting ? (
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-[3px] border-white/20 border-t-white rounded-full animate-spin" />
                <span>Processing...</span>
              </div>
            ) : showSuccess ? (
              <div className="flex items-center gap-2 animate-in fade-in zoom-in duration-300">
                <span>Copied Successfully</span>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span>Convert & Copy</span>
              </div>
            )}
          </Button>
        </div>
      </header>

      {/* Main Grid */}
      <main className="max-w-[1600px] mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-[calc(100vh-220px)]">
          {/* HTML Card */}
          <Card className="flex flex-col overflow-hidden border-border/40 shadow-2xl shadow-blue-500/5 hover:border-border/60 transition-colors">
            <div className="px-5 py-3 border-b border-border/40 bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-pulse"></div>
                <h2 className="text-sm font-semibold text-foreground/80 tracking-wide uppercase">Source HTML</h2>
              </div>
              <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter">Read-Only View Enabled</span>
            </div>
            <CardContent className="p-0 flex-1 bg-[#1e1e1e]">
              <Editor
                height="100%"
                defaultLanguage="html"
                value={html}
                onChange={(value) => setHtml(value || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  lineHeight: 1.6,
                  padding: { top: 20, bottom: 20 },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  tabSize: 2,
                  renderLineHighlight: 'all',
                  fontWeight: '500',
                  smoothScrolling: true,
                  cursorBlinking: 'smooth',
                  cursorSmoothCaretAnimation: 'on',
                  scrollbar: {
                    verticalScrollbarSize: 10,
                    horizontalScrollbarSize: 10,
                  },
                }}
              />
            </CardContent>
          </Card>

          {/* CSS Card */}
          <Card className="flex flex-col overflow-hidden border-border/40 shadow-2xl shadow-purple-500/5 hover:border-border/60 transition-colors">
            <div className="px-5 py-3 border-b border-border/40 bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse"></div>
                <h2 className="text-sm font-semibold text-foreground/80 tracking-wide uppercase">Styles CSS</h2>
              </div>
              <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-tighter">Style Resolution Active</span>
            </div>
            <CardContent className="p-0 flex-1 bg-[#1e1e1e]">
              <Editor
                height="100%"
                defaultLanguage="css"
                value={css}
                onChange={(value) => setCss(value || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
                  lineHeight: 1.6,
                  padding: { top: 20, bottom: 20 },
                  scrollBeyondLastLine: false,
                  wordWrap: 'on',
                  tabSize: 2,
                  renderLineHighlight: 'all',
                  fontWeight: '500',
                  smoothScrolling: true,
                  cursorBlinking: 'smooth',
                  cursorSmoothCaretAnimation: 'on',
                  scrollbar: {
                    verticalScrollbarSize: 10,
                    horizontalScrollbarSize: 10,
                  },
                }}
              />
            </CardContent>
          </Card>
        </div>

        {/* Info Legend */}
        <div className="mt-8 flex items-center justify-center gap-12 text-muted-foreground/50">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/40"></div>
            <span className="text-[11px] font-bold uppercase tracking-widest leading-none">Auto-ID Generation</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/40"></div>
            <span className="text-[11px] font-bold uppercase tracking-widest leading-none">Shorthand Expansion</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary/40"></div>
            <span className="text-[11px] font-bold uppercase tracking-widest leading-none">Style Resolution</span>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
