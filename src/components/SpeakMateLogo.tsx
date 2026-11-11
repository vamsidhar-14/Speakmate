import React from 'react';
import { FluencisLogo, FluencisLogoProps } from './FluencisLogo';

export const SpeakMateLogo: React.FC<FluencisLogoProps> = (props) => {
  return <FluencisLogo {...props} />;
};

export type SpeakMateLogoProps = FluencisLogoProps;
export { FluencisLogo };
