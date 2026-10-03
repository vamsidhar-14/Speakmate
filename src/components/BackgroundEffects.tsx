import React from 'react';

export const BackgroundEffects: React.FC = () => {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Radial ambient glow */}
      <div
        className="absolute rounded-full blur-[45px] opacity-40"
        style={{
          width: '360px',
          height: '360px',
          left: '-120px',
          top: '100px',
          background: 'radial-gradient(circle, #20f5a2, #0077ff 45%, transparent 70%)',
        }}
      />
      <div
        className="absolute rounded-full blur-[55px] opacity-35"
        style={{
          width: '420px',
          height: '420px',
          right: '-160px',
          bottom: '60px',
          background: 'radial-gradient(circle, #00d9ff, #20f5a2 45%, transparent 70%)',
        }}
      />

      {/* Floating 3D rings */}
      <div
        className="absolute rounded-full animate-ring-float opacity-50"
        style={{
          width: '110px',
          height: '110px',
          left: '5%',
          top: '25%',
          border: '10px solid transparent',
          borderLeftColor: '#20f5a2',
          borderBottomColor: '#00bfff',
          filter: 'drop-shadow(0 0 14px #00d9ff)',
        }}
      />
      <div
        className="absolute rounded-full animate-ring-float-reverse opacity-45"
        style={{
          width: '75px',
          height: '75px',
          right: '6%',
          top: '45%',
          border: '9px solid transparent',
          borderLeftColor: '#00bfff',
          borderBottomColor: '#20f5a2',
          filter: 'drop-shadow(0 0 12px #20f5a2)',
        }}
      />

      {/* Floating 3D sphere balls */}
      <div
        className="absolute rounded-full animate-ball-float"
        style={{
          width: '32px',
          height: '32px',
          right: '15%',
          top: '18%',
          background: 'radial-gradient(circle at 30% 25%, white, #20f5a2 20%, #008cff 55%, #021326 100%)',
          boxShadow: '0 0 20px #00cfff',
        }}
      />
      <div
        className="absolute rounded-full animate-ball-float"
        style={{
          width: '20px',
          height: '20px',
          left: '16%',
          bottom: '22%',
          animationDelay: '1.5s',
          background: 'radial-gradient(circle at 30% 25%, white, #20f5a2 20%, #008cff 55%, #021326 100%)',
          boxShadow: '0 0 15px #20f5a2',
        }}
      />
    </div>
  );
};
