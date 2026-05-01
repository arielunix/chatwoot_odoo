import {
  Table as MuiTable,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from "@mui/material";

export const Table = ({ columns, data, onRowClick }) => {
  return (
    <TableContainer component={Paper} sx={{ boxShadow: "none" }}>
      <MuiTable>
        <TableHead>
          <TableRow sx={{ background: "#f8f9fa" }}>
            {columns.map((column) => (
              <TableCell
                key={column.field}
                sx={{
                  fontWeight: 600,
                  fontSize: 13,
                  color: "#495057",
                  borderBottom: "2px solid #dee2e6",
                }}
              >
                {column.header}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((row, index) => (
            <TableRow
              key={index}
              hover
              onClick={() => onRowClick && onRowClick(row)}
              sx={{ cursor: onRowClick ? "pointer" : "default" }}
            >
              {columns.map((column) => (
                <TableCell
                  key={column.field}
                  sx={{
                    borderBottom: "1px solid #dee2e6",
                    fontSize: 14,
                    color: "#495057",
                  }}
                >
                  {column.render ? column.render(row) : row[column.field]}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </MuiTable>
    </TableContainer>
  );
};
