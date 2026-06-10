import React from 'react';
import logoLight from '../assets/branding/logo-light.png';
import logoDark from '../assets/branding/logo-dark.png';
import isoLight from '../assets/branding/iso-light.png';
import isoDark from '../assets/branding/iso-dark.png';

const AfinixLogo = ({ 
  size = 40, 
  theme = 'dark', // 'light' o 'dark'
  isLogin = false,
  showText = true
}) => {
  const logoSrc = theme === 'dark'
    ? (showText ? logoDark : isoDark)
    : (showText ? logoLight : isoLight);
  
  // Usamos una variable CSS para permitir escalado responsivo, con el prop size como valor por defecto
  const logoHeightVar = `var(--afinix-logo-size, ${isLogin ? size * 1.5 : size}px)`;
  
  const containerStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    userSelect: 'none',
    WebkitUserSelect: 'none',
    height: logoHeightVar,
    width: 'auto',
    overflow: 'visible'
  };

  return (
    <div className={`afinix-logo ${showText ? 'afinix-logo--horizontal' : 'afinix-logo--iso'}`} style={containerStyle}>
      <img 
        src={logoSrc} 
        alt="AFINIX Dental Lab" 
        draggable={false}
        style={{ 
          height: '100%',
          width: 'auto',
          display: 'block',
          objectFit: 'contain',
          flexShrink: 0,
          userSelect: 'none',
          WebkitUserSelect: 'none',
          pointerEvents: 'none'
        }} 
      />
    </div>
  );
};


export default AfinixLogo;
