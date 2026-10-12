import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import { useAuth } from "../../context/AuthContext";

function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const isFormValid =
    username.trim() !== "" &&
    password.trim() !== "";

  async function handleSubmit(event) {
    event.preventDefault();

    if (!isFormValid || submitting) {
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      const user = await login(
        username.trim(),
        password
      );

      if (user.role === "admin") {
        navigate("/admin/dashboard");
      } else if (user.role === "employee") {
        navigate("/employee/dashboard");
      } else if (user.role === "user") {
        navigate("/user/dashboard");
      } else {
        setError("Invalid account role.");
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">

        <div className="auth-heading">
          <h1>PMS</h1>
          <p>Parking Management System</p>
        </div>

        <form
          className="auth-form"
          onSubmit={handleSubmit}
        >
          <h2>Login</h2>

          <Input
            label="Username"
            name="username"
            value={username}
            onChange={(event) =>
              setUsername(event.target.value)
            }
            placeholder="Enter your username"
            autoComplete="username"
            required
          />

          <Input
            label="Password"
            name="password"
            type="password"
            value={password}
            onChange={(event) =>
              setPassword(event.target.value)
            }
            placeholder="Enter your password"
            autoComplete="current-password"
            required
          />

          {error && (
            <p className="form-error">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={!isFormValid || submitting}
          >
            {submitting
              ? "Logging in..."
              : "Login"}
          </Button>

          <button
            type="button"
            className="auth-link"
            onClick={() =>
              navigate("/forgot-password")
            }
          >
            Forgot Password?
          </button>

          <div className="auth-account-prompt">
            <span>Don't have an account?</span>

            <button
              type="button"
              className="auth-link"
              onClick={() =>
                navigate("/user/register")
              }
            >
              Create Account
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}

export default Login;