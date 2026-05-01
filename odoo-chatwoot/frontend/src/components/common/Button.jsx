import { Button as MuiButton } from "@mui/material";

export const Button = ({ children, variant = "contained", color = "primary", ...props }) => {
  return (
    <MuiButton variant={variant} color={color} {...props}>
      {children}
    </MuiButton>
  );
};
