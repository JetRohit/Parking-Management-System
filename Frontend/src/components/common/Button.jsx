function Button({
  children,
  type = "button",
  disabled = false,
  onClick,
  className = "",
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`app-button ${className}`}
    >
      {children}
    </button>
  );
}

export default Button;