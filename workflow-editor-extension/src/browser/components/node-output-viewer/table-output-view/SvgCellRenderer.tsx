import React from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';

export interface SvgCellRendererProps {
    svgContent: string;
    onClick: (svgContent: string) => void;
}

export function SvgCellRenderer({ svgContent, onClick }: SvgCellRendererProps) {
    if (!svgContent) {
        return <span></span>;
    }

    const dataUri = `data:image/svg+xml;base64,${btoa(svgContent)}`;

    return (
        <Box
            sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                width: '100%',
                height: '100%',
                overflow: 'hidden',
            }}
        >
            <img
                src={dataUri}
                alt="SVG"
                style={{
                    maxWidth: 'calc(100% - 30px)',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    flexShrink: 1,
                }}
            />
            <Tooltip title="Expand SVG">
                <IconButton
                    size="small"
                    onClick={(e) => {
                        e.stopPropagation();
                        onClick(svgContent);
                    }}
                    sx={{
                        ml: 'auto',
                        flexShrink: 0,
                        padding: '2px',
                    }}
                >
                    <OpenInNewIcon fontSize="small" />
                </IconButton>
            </Tooltip>
        </Box>
    );
}

