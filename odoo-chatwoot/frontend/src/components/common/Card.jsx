import { Card as MuiCard, CardContent, CardHeader } from "@mui/material";

export const Card = ({ title, children, headerColor = "#875A7B" }) => {
  return (
    <MuiCard
      sx={{
        borderRadius: 2,
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        mb: 2,
      }}
    >
      {title && (
        <CardHeader
          title={title}
          sx={{
            background: headerColor,
            color: "white",
            "& .MuiCardHeader-title": {
              fontWeight: "bold",
              fontSize: 16,
            },
          }}
        />
      )}
      <CardContent>{children}</CardContent>
    </MuiCard>
  );
};
