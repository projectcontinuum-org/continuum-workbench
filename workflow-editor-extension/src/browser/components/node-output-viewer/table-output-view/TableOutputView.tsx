import { IData } from "@continuum/core";
import { DataGrid, GridColDef, GridPaginationModel } from "@mui/x-data-grid";
import React, { useCallback, useEffect, useState } from "react";
import DataService from "../../../service/DataService";
import { JsonCellRenderer } from "./JsonCellRenderer";
import { JsonViewerDialog } from "./JsonViewerDialog";
import { SvgCellRenderer } from "./SvgCellRenderer";
import { SvgViewerDialog } from "./SvgViewerDialog";

const dataService = new DataService();

export interface TableOutputViewProps {
    outputData: IData;
}

export function TableOutputView({outputData}: TableOutputViewProps) {
    const [rows, setRows] = React.useState<any[]>([]);
    const [rowsCount, setRowsCount] = React.useState<number>(0);
    const [columns, setColumns] = React.useState<GridColDef<any>[]>([]);
    const [page, setPage] = React.useState<number>(0);
    const [pageSize, setPageSize] = React.useState<number>(25);
    const [loading, setLoading] = React.useState<boolean>(true);
    const [jsonViewerOpen, setJsonViewerOpen] = useState(false);
    const [selectedJsonValue, setSelectedJsonValue] = useState<any>(null);
    const [svgViewerOpen, setSvgViewerOpen] = useState(false);
    const [selectedSvgContent, setSelectedSvgContent] = useState<string | null>(null);

    const deserializeCell = (cell: any): any => {
        // Decode base64 value to string
        const valueString = atob(cell.value);

        switch(cell.contentType) {
            case "application/vnd.continuum.x-string":
                return valueString;
            case "application/vnd.continuum.x-int":
                return parseInt(valueString, 10);
            case "application/vnd.continuum.x-long":
                return BigInt(valueString);
            case "application/vnd.continuum.x-float":
                return parseFloat(valueString);
            case "application/vnd.continuum.x-double":
                return parseFloat(valueString);
            case "application/vnd.continuum.x-boolean":
                return valueString.toLowerCase() === "true";
            case "application/json":
                return JSON.parse(valueString);
            case "image/svg+xml":
                return { __type: "svg", content: valueString };
            default:
                console.warn(`Unsupported content type: ${cell.contentType}`);
                return valueString;
        }
    };

    useEffect(()=>{
        dataService.getNodeData(outputData.data, page, pageSize).then((data) => {
            if(data.data.length > 0) {
                // console.log(`Page: ${JSON.stringify(data)}`)
                setRowsCount(data.totalElements);
                setRows(data.data.map((row: Array<any>, idx: number) => {
                    let newRow: any = {id: idx};
                    row.forEach((cell: any) => {
                        newRow[cell.name] = deserializeCell(cell);
                    });
                    return newRow;
                }));
                setColumns(data.data[0].map((cell: any) => ({
                    field: cell.name,
                    headerName: cell.name,
                    flex: 1,
                    minWidth: 150,
                    renderCell: (params: any) => {
                        // Render SVG content with expand button
                        if (typeof params.value === 'object' && params.value !== null && params.value.__type === 'svg') {
                            return <SvgCellRenderer
                                svgContent={params.value.content}
                                onClick={(svg) => {
                                    setSelectedSvgContent(svg);
                                    setSvgViewerOpen(true);
                                }}
                            />;
                        }
                        if (typeof params.value === 'object' && params.value !== null) {
                            return <JsonCellRenderer
                                value={params.value}
                                onClick={(value) => {
                                    setSelectedJsonValue(value);
                                    setJsonViewerOpen(true);
                                }}
                            />;
                        }
                        // Handle boolean values explicitly (they don't render as text by default)
                        if (typeof params.value === 'boolean') {
                            return params.value ? 'true' : 'false';
                        }
                        return params.value;
                    }
                })));
                setLoading(false);
            }
        });
    }, [outputData, page, pageSize, setRowsCount, setRows, setColumns]);

    const onPaginationModelChange = useCallback((model: GridPaginationModel)=>{
        setRows([]);
        // setColumns([]);
        setPage(model.page);
        setPageSize(model.pageSize);
        setLoading(true);
    }, [setPage, setPageSize]);

    return (
        <>
            <DataGrid
                rows={rows}
                rowCount={rowsCount}
                columns={columns}
                pageSizeOptions={[5, 25, 50, 100]}
                paginationMode="server"
                paginationModel={{
                    page: page,
                    pageSize: pageSize
                }}
                onPaginationModelChange={onPaginationModelChange}
                loading={loading}
                sx={{
                    width: "100%",
                    height: "100%",
                    minWidth: 0,
                    minHeight: 0,
                    "& .MuiDataGrid-virtualScroller": {
                        overflowY: "auto", // Make only the rows scrollable
                    },
                    "& .MuiDataGrid-columnHeaders": {
                        position: "sticky",
                        top: 0,
                        zIndex: 1, // Ensure the header stays on top
                    },
                    "& .MuiDataGrid-footerContainer": {
                        position: "sticky",
                        bottom: 0,
                        zIndex: 1, // Ensure the footer stays on top
                    }
                }}/>
            <JsonViewerDialog
                open={jsonViewerOpen}
                value={selectedJsonValue}
                onClose={() => setJsonViewerOpen(false)}
            />
            <SvgViewerDialog
                open={svgViewerOpen}
                svgContent={selectedSvgContent}
                onClose={() => setSvgViewerOpen(false)}
            />
        </>
    );
}