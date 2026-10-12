import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";

function ForgotPassword() {
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");

  const navigate = useNavigate();

  const isFormValid = username.trim() !== "";

  function handleSubmit(event) {
    event.preventDefault();

    if (!isFormValid) {
      return;
    }

    setMessage(
      "Notification has been sent to admin. Contact admin."
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-heading">
          <h1>PMS</h1>
          <p>Parking Management System</p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <h2>Forgot Password</h2>

          <p className="auth-description">
            Enter your username to request a password reset.
          </p>

          <Input
            label="Username"
            name="forgotUsername"
            value={username}
            onChange={(event) => {
              setUsername(event.target.value);
              setMessage("");
            }}
            placeholder="Enter your username"
            autoComplete="username"
            required
          />

          {message && (
            <p className="form-success">
              {message}
            </p>
          )}

          <Button
            type="submit"
            disabled={!isFormValid}
          >
            Send Request
          </Button>

          <button
            type="button"
            className="auth-link"
            onClick={() => navigate("/login")}
          >
            Back to Login
          </button>
        </form>
      </div>
    </div>
  );
}

export default ForgotPassword;