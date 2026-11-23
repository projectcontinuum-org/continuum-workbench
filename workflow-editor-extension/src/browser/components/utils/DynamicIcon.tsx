import React from 'react';
import SVG from 'react-inlinesvg';
import QuestionMarkIcon from '@mui/icons-material/QuestionMark';
import { SvgIcon, SvgIconProps } from '@mui/material';
import { sanitizeSvg } from '../../../common/SvgSanitizer';

export default function DynamicIcon({icon, ...others}: SvgIconProps & {icon?: string}) {
    icon = icon?.trim();
    if (icon) {
        if(icon.toLowerCase().startsWith("<svg")){
            return (
                <SvgIcon {...others}>
                    <SVG src={icon} preProcessor={sanitizeSvg}/>
                </SvgIcon>
            );
        }
    }
    return <QuestionMarkIcon/>;
}