import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { GoogleGenAI } from "@google/genai";
import { Upload, User, Sparkles, RefreshCw, Image as ImageIcon, AlertCircle, Mars, Venus } from "lucide-react";

// --- Types ---

interface PredictionResult {
  gender: 'boy' | 'girl';
  age: number;
  imageUrl?: string;
  loading: boolean;
  error?: string;
}

interface UploadedImage {
  file: File;
  preview: string;
  base64Data: string;
  mimeType: string;
}

// --- Components ---

const App = () => {
  const [fatherImg, setFatherImg] = useState<UploadedImage | null>(null);
  const [motherImg, setMotherImg] = useState<UploadedImage | null>(null);
  const [fatherDominance, setFatherDominance] = useState<number>(50);
  const [generatingTarget, setGeneratingTarget] = useState<'boy' | 'girl' | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize results state for 6 variations
  const [results, setResults] = useState<PredictionResult[]>([
    { gender: 'boy', age: 5, loading: false },
    { gender: 'boy', age: 15, loading: false },
    { gender: 'boy', age: 25, loading: false },
    { gender: 'girl', age: 5, loading: false },
    { gender: 'girl', age: 15, loading: false },
    { gender: 'girl', age: 25, loading: false },
  ]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, parent: 'father' | 'mother') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError("Please upload a valid image file.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Extract base64 data (remove "data:image/jpeg;base64,")
      const base64Data = result.split(',')[1];
      
      const imgData: UploadedImage = {
        file,
        preview: result,
        base64Data,
        mimeType: file.type
      };

      if (parent === 'father') setFatherImg(imgData);
      else setMotherImg(imgData);
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const generatePrediction = async (targetGender: 'boy' | 'girl') => {
    if (!fatherImg || !motherImg) {
      setError("Please upload photos of both parents first.");
      return;
    }
    if (!process.env.API_KEY) {
      setError("API Key is missing.");
      return;
    }

    setGeneratingTarget(targetGender);
    setError(null);

    // Reset results for the specific gender to loading state
    setResults(prev => prev.map(r => 
      r.gender === targetGender 
        ? { ...r, loading: true, error: undefined, imageUrl: undefined } 
        : r
    ));

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'gemini-2.5-flash-image';

    // Helper to generate one specific variation
    const generateVariation = async (item: PredictionResult, index: number) => {
      try {
        const genderTerm = item.gender === 'boy' ? (item.age > 18 ? 'man' : 'boy') : (item.age > 18 ? 'woman' : 'girl');
        
        const fatherPct = fatherDominance;
        const motherPct = 100 - fatherDominance;

        const prompt = `
          Generate a photorealistic portrait of a ${item.age}-year-old ${genderTerm}.
          This person is the hypothetical child of the two people in the provided images.
          
          Blend the physical facial features of the first image (father) and the second image (mother).
          The facial structure and features should resemble the father by approximately ${fatherPct}% and the mother by approximately ${motherPct}%.
          
          Ensure the image is high quality, clear, and has a neutral background. 
          Focus on facial accuracy and genetic blending.
        `;

        const response = await ai.models.generateContent({
          model,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: fatherImg.mimeType,
                  data: fatherImg.base64Data
                }
              },
              {
                inlineData: {
                  mimeType: motherImg.mimeType,
                  data: motherImg.base64Data
                }
              },
              { text: prompt }
            ]
          }
        });

        // Parse response for image
        let generatedUrl = '';
        if (response.candidates && response.candidates[0].content.parts) {
          for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
              generatedUrl = `data:image/png;base64,${part.inlineData.data}`;
              break;
            }
          }
        }

        if (!generatedUrl) throw new Error("No image generated");

        setResults(current => {
          const newResults = [...current];
          newResults[index] = { ...item, loading: false, imageUrl: generatedUrl };
          return newResults;
        });

      } catch (err) {
        console.error(err);
        setResults(current => {
          const newResults = [...current];
          newResults[index] = { ...item, loading: false, error: "Failed to generate" };
          return newResults;
        });
      }
    };

    // Filter tasks for the selected gender
    const tasks = results
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.gender === targetGender);

    const promises = tasks.map(({ item, index }) => generateVariation(item, index));
    
    await Promise.allSettled(promises);
    setGeneratingTarget(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 pb-20 font-sans">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 py-6 px-4 mb-8 sticky top-0 z-50/ shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <Sparkles className="text-indigo-600 w-8 h-8" />
          <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
            AI Child Face Predictor
          </h1>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 space-y-8">
        
        {/* Top Section: Uploads & Config */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 md:p-8 space-y-8">
            
            {/* Upload Area */}
            <div className="grid md:grid-cols-2 gap-8">
              {/* Father Input */}
              <div className="flex flex-col gap-4">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-700">
                  <User className="w-5 h-5 text-blue-500" />
                  Father's Photo
                </h2>
                <div className={`
                  relative group cursor-pointer border-2 border-dashed rounded-2xl h-64 flex items-center justify-center transition-all overflow-hidden
                  ${fatherImg ? 'border-indigo-300 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-100'}
                `}>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={(e) => handleFileUpload(e, 'father')}
                  />
                  {fatherImg ? (
                    <img src={fatherImg.preview} alt="Father" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4">
                      <div className="bg-white p-3 rounded-full shadow-sm inline-block mb-3">
                        <Upload className="w-6 h-6 text-indigo-500" />
                      </div>
                      <p className="text-sm text-slate-500 font-medium">Click to upload Father</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Mother Input */}
              <div className="flex flex-col gap-4">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-700">
                  <User className="w-5 h-5 text-pink-500" />
                  Mother's Photo
                </h2>
                <div className={`
                  relative group cursor-pointer border-2 border-dashed rounded-2xl h-64 flex items-center justify-center transition-all overflow-hidden
                  ${motherImg ? 'border-pink-300 bg-pink-50' : 'border-slate-300 hover:border-pink-400 hover:bg-slate-100'}
                `}>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    onChange={(e) => handleFileUpload(e, 'mother')}
                  />
                   {motherImg ? (
                    <img src={motherImg.preview} alt="Mother" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4">
                      <div className="bg-white p-3 rounded-full shadow-sm inline-block mb-3">
                        <Upload className="w-6 h-6 text-pink-500" />
                      </div>
                      <p className="text-sm text-slate-500 font-medium">Click to upload Mother</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Genetic Slider */}
            <div className="pt-6 border-t border-slate-100">
               <div className="max-w-2xl mx-auto space-y-4">
                <div className="flex justify-between items-end">
                  <label className="text-sm font-bold text-slate-700">Genetic Blend Setting</label>
                  <span className="text-xs text-slate-500 bg-slate-100 px-3 py-1 rounded-full font-mono">
                    {fatherDominance}% Father / {100 - fatherDominance}% Mother
                  </span>
                </div>
                
                <div className="flex items-center gap-4">
                  <span className="text-xs md:text-sm font-semibold text-blue-600 w-24 text-right">Stronger Father</span>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={fatherDominance} 
                    onChange={(e) => setFatherDominance(Number(e.target.value))}
                    className="flex-1 h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-500 transition-all"
                  />
                  <span className="text-xs md:text-sm font-semibold text-pink-600 w-24">Stronger Mother</span>
                </div>
              </div>
            </div>

            {error && (
              <div className="flex items-center justify-center gap-2 text-red-600 bg-red-50 p-4 rounded-xl border border-red-100 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5" />
                <span className="font-medium">{error}</span>
              </div>
            )}
          </div>
        </section>

        {/* Prediction Areas - Split by Gender */}
        <div className="grid lg:grid-cols-2 gap-8">
          
          {/* Son Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-blue-100 flex flex-col h-full overflow-hidden">
             <div className="p-6 border-b border-blue-50 bg-blue-50/30 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
                    <User className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">Predicted Son</h3>
                </div>
                
                <button
                  onClick={() => generatePrediction('boy')}
                  disabled={!!generatingTarget || !fatherImg || !motherImg}
                  className={`
                    flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-sm font-semibold shadow-md transition-all
                    ${generatingTarget || !fatherImg || !motherImg 
                      ? 'bg-slate-300 cursor-not-allowed shadow-none' 
                      : 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:shadow-lg hover:-translate-y-0.5 active:scale-95'}
                  `}
                >
                  {generatingTarget === 'boy' ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Generating...</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> Generate Son</>
                  )}
                </button>
             </div>
             
             <div className="p-6 bg-slate-50/50 flex-grow">
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 h-full">
                  {results.filter(r => r.gender === 'boy').map((result) => (
                    <ResultCard key={`boy-${result.age}`} result={result} />
                  ))}
               </div>
             </div>
          </section>

          {/* Daughter Section */}
          <section className="bg-white rounded-2xl shadow-sm border border-pink-100 flex flex-col h-full overflow-hidden">
             <div className="p-6 border-b border-pink-50 bg-pink-50/30 flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-pink-100 p-2 rounded-lg text-pink-600">
                    <User className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">Predicted Daughter</h3>
                </div>
                
                <button
                  onClick={() => generatePrediction('girl')}
                  disabled={!!generatingTarget || !fatherImg || !motherImg}
                  className={`
                    flex items-center gap-2 px-5 py-2.5 rounded-full text-white text-sm font-semibold shadow-md transition-all
                    ${generatingTarget || !fatherImg || !motherImg 
                      ? 'bg-slate-300 cursor-not-allowed shadow-none' 
                      : 'bg-gradient-to-r from-pink-500 to-rose-600 hover:shadow-lg hover:-translate-y-0.5 active:scale-95'}
                  `}
                >
                   {generatingTarget === 'girl' ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" /> Generating...</>
                  ) : (
                    <><Sparkles className="w-4 h-4" /> Generate Daughter</>
                  )}
                </button>
             </div>
             
             <div className="p-6 bg-slate-50/50 flex-grow">
               <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 h-full">
                  {results.filter(r => r.gender === 'girl').map((result) => (
                    <ResultCard key={`girl-${result.age}`} result={result} />
                  ))}
               </div>
             </div>
          </section>

        </div>
      </main>
    </div>
  );
};

const ResultCard = ({ result }: { result: PredictionResult }) => {
  return (
    <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-slate-100 flex flex-col relative aspect-[4/5] sm:aspect-[3/4] group">
      {result.loading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-3 bg-slate-50">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Generating {result.age}y...</span>
        </div>
      ) : result.error ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400 gap-2 p-4 text-center bg-red-50/50">
          <AlertCircle className="w-8 h-8" />
          <span className="text-xs font-medium">{result.error}</span>
        </div>
      ) : result.imageUrl ? (
        <>
          <img 
            src={result.imageUrl} 
            alt={`Predicted ${result.age} year old ${result.gender}`} 
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 gap-2 bg-slate-50">
          <ImageIcon className="w-10 h-10" />
          <span className="text-xs font-medium">No Image</span>
        </div>
      )}
      
      {/* Age Badge */}
      <div className="absolute bottom-3 left-3 z-10">
        <span className={`
          px-3 py-1 rounded-full text-xs font-bold shadow-sm backdrop-blur-md border border-white/20
          ${result.imageUrl 
            ? 'bg-white/90 text-slate-900' 
            : 'bg-slate-200 text-slate-500'}
        `}>
          {result.age} Years Old
        </span>
      </div>
    </div>
  );
};

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}