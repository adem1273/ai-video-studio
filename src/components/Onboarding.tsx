import { useEffect, useState } from 'react'
import { BorderBottom, Layout, Loader2, Mail, Mic, Music, Palette, Settings, Sun, Moon, Settings2, CheckCircle2 } from 'lucide-react'

const Onboarding: React.FC = () => {
  const [step, setStep] = useState(1)
  const [completed, setCompleted] = useState(false)

  // Check if onboarding was already completed
  useEffect(() => {
    const hasCompleted = localStorage.getItem('onboardingCompleted')
    if (hasCompleted) {
      setCompleted(true)
    }
  }, [])

  // Complete onboarding
  const completeOnboarding = () => {
    localStorage.setItem('onboardingCompleted', 'true')
    setCompleted(true)
    setStep(1)
  }

  const nextStep = () => {
    setStep(prev => Math.min(prev + 1, 4))
  }

  const prevStep = () => {
    setStep(prev => Math.max(prev - 1, 1))
  }

  if (completed) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-slate-800 rounded-2xl w-full max-w-md mx-4 p-8 shadow-2xl transform transition-all duration-500">
        <div className="mb-6 text-center">
          {step === 1 && (
            <BorderBottom className="w-12 h-12 mx-auto mb-4 text-slate-400">
              <Music size={48} />
            </BorderBottom>
          )}
          {step === 2 && (
            <BorderBottom className="w-12 h-12 mx-auto mb-4 text-slate-400">
              <Palette size={48} />
            </BorderBottom>
          )}
          {step === 3 && (
            <BorderBottom className="w-12 h-12 mx-auto mb-4 text-slate-400">
              <Mic size={48} />
            </BorderBottom>
          )}
          {step === 4 && (
            <BorderBottom className="w-12 h-12 mx-auto mb-4 text-slate-400">
              <CheckCircle2 size={48} className="text-emerald-400" />
            </BorderBottom>
          )}
          <h2 className="text-xl font-medium text-slate-100 mb-2">
            {step === 1 ? 'Video Oluşturma Başlıyor' : step === 2 ? 'Senaryo Yazma' : step === 3 ? 'Görsel ve Video' : 'Bitiriliyor'}
          </h2>
          <p className="text-slate-400 text-sm mb-6">{getOnboardingText(step)}</p>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xxs text-slate-500 mb-2">
            <span>1</span>
            <span>2</span>
            <span>3</span>
            <span>4</span>
          </div>
          <div className="bg-slate-700 rounded-full h-2">
            <div className="bg-slate-300 rounded-full h-2 transition-width" style={{ width: `${(step / 4) * 100}%` }} />
          </div>
        </div>

        {/* Step Content */}
        <div className="space-y-4">
          {/* Step 1: Welcome */}
          {step === 1 && (
            <div>
              <p className="text-slate-400 text-sm">
                Sohbetimsen'e hoş geldiniz! Yapay zeka ile professionel kalitede videolar üretmek için 4 adımı takip edin.
              </p>
            </div>
          )}

          {/* Step 2: Scenario Writing */}
          {step === 2 && (
            <div>
              <p className="text-slate-400 text-sm">
                Fikirlerinizi yazın veya "Fabrika" modunda 4 AI ajanı (Senarist, Görsel Yönetmen, Video Küratör, SEO Uzmanı) birden çalıştırın.
              </p>
              <p className="text-slate-500 text-xs mt-2">Örnek prompt: "20 gün içinde Mars'ta insan kolonisi kurulması"</p>
            </div>
          )}

          {/* Step 3: Media & Customization */}
          {step === 3 && (
            <div>
              <p className="text-slate-400 text-sm">
                Ses, müzik, format, çözünürlük ve marka ayarlarını yapılandırın. TTS ile seslendirme yapın veya kendi müziğinizi ekleyin.
              </p>
              <p className="text-slate-500 text-xs mt-2">Örnek: "Seslendirme: Nova, Müzik: Cinematic"</p>
            </div>
          )}

          {/* Step 4: Finish */}
          {step === 4 && (
            <div>
              <p className="text-slate-400 text-sm">
                Tebrikler! Artık videonuzu önizleyip render edebilirsiniz. "Video" sekmesinde sesli önizleme yapın veya bir tıkla videoyu render edin.
              </p>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between mt-8">
          {step > 1 && (
            <button
              onClick={prevStep}
              className="flex-1 px-4 py-2 rounded-lg bg-slate-700 text-slate-100 text-sm font-medium transition:hover hover:bg-slate-600 disabled:bg-slate-900 disabled:text-slate-500"
              aria-label="Önceki adım">
              ← Önceki
            </button>
          )}
          {step < 4 && (
            <button
              onClick={nextStep}
              className="flex-1 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm font-medium transition disabled:bg-slate-900 disabled:text-slate-600"
              aria-label="Sonraki adım">
              Sonraki →
            </button>
          )}
          {step === 4 && (
            <button
              onClick={completeOnboarding}
              className="flex-1 px-4 py-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-sm font-medium transition">
              Bitti
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function getOnboardingText(step: number): string {
  const texts = [
    'Sohbetimsen'e hoş geldiniz! Videoluşturma sürecine başlıyoruz.',
    'Fikirlerinizi yazın veya "Fabrika" modunda 4 AI ajanı birden çalıştırın.',
    'Ses, müzik, format, çözünürlük ve marka ayarlarını yapılandırın.',
    'Tebrikler! Artık videonuzu önizleyip render edebilirsiniz.'
  ]
  return texts[step - 1]
}

export default Onboarding
