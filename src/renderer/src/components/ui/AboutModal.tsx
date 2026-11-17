import React from 'react'
import { X, Info } from 'lucide-react'
import { useAppStore } from '../../stores/useAppStore'
import semplyLogo from '../../assets/icons/semply_logo.png'

export const AboutModal: React.FC = () => {
  const { isAboutModalOpen, toggleAboutModal } = useAppStore()

  if (!isAboutModalOpen) return null

  return (
    <div className="fixed inset-0 z-[120] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[#1c1f26] border border-[#2d323f] rounded-lg w-full max-w-sm shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        <div className="h-10 bg-[#171a21] border-b border-[#2b2f3a] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white">
            <Info className="w-4 h-4 text-[#2a69df]" />
            <span className="text-[13px] font-semibold">About Semply</span>
          </div>
          <button
            onClick={() => toggleAboutModal(false)}
            className="w-6 h-6 flex items-center justify-center text-[#8b949e] hover:text-white hover:bg-[#282c37] rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 text-center space-y-4">
           {/* Logo */}
           <img src={semplyLogo} alt="Semply Logo" className="w-16 h-16 mx-auto object-contain" />
           <div>
             <h2 className="text-lg font-semibold text-white">Semply Reader</h2>
             <p className="text-xs text-[#8b949e]">Version 1.0.0</p>
           </div>
           <p className="text-xs text-[#c9d1d9] leading-relaxed">
             Pure reading. Native speed. <br/>
             100% local-first, privacy-focused, and open source under the MIT License.
           </p>
        </div>
        <div className="bg-[#171a21] border-t border-[#2b2f3a] p-4 flex justify-center gap-4">
          <a
            href="https://github.com/ederaefe/EPUB-Reader-Desktop"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#2a69df] hover:underline"
          >
            GitHub
          </a>
          <a
            href="https://github.com/ederaefe/EPUB-Reader-Desktop#readme"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#2a69df] hover:underline"
          >
            User Manual
          </a>
        </div>
      </div>
    </div>
  )
}
