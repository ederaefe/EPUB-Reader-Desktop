import React from 'react'

export const AppBackground: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
      <div className="absolute -top-32 -left-20 w-[550px] h-[550px] rounded-full bg-[#1a2d52] opacity-35 blur-[130px]" />
      <div className="absolute top-1/2 -right-32 w-[600px] h-[600px] rounded-full bg-[#271d47] opacity-30 blur-[140px]" />
      <div className="absolute -bottom-24 left-1/3 w-[500px] h-[500px] rounded-full bg-[#123328] opacity-25 blur-[120px]" />
    </div>
  )
}
