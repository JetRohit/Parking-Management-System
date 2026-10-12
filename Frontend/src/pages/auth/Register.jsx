import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import apiRequest from "../../services/api";


function Register() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);


  const isFormValid =
    username.trim() !== "" &&
    password.trim() !== "" &&
    confirmPassword.trim() !== "" &&
    password === confirmPassword;


  async function handleSubmit(event) {
    event.preventDefault();

    if (!isFormValid || submitting) {
      return;
    }

    setError("");
    setSuccess("");
    setSubmitting(true);

    try {
      const response = await apiRequest(
        "/register",
        {
          method: "POST",
          body: JSON.stringify({
            username: username.trim(),
            password,
          }),
          skipAuthRedirect: true,
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Registration failed."
        );
      }

      setSuccess(
        "Registration successful. You can now log in."
      );

      setUsername("");
      setPassword("");
      setConfirmPassword("");

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

          <h2>Create Account</h2>


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
            autoComplete="new-password"
            required
          />


          <Input
            label="Confirm Password"
            name="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(event) =>
              setConfirmPassword(event.target.value)
            }
            placeholder="Confirm your password"
            autoComplete="new-password"
            required
          />


          {password !== "" &&
            confirmPassword !== "" &&
            password !== confirmPassword && (
              <p className="form-error">
                Passwords do not match.
              </p>
            )}


          {error && (
            <p className="form-error">
              {error}
            </p>
          )}


          {success && (
            <p className="form-success">
              {success}
            </p>
          )}


          <Button
            type="submit"
            disabled={
              !isFormValid || submitting
            }
          >
            {submitting
              ? "Creating Account..."
              : "Create Account"}
          </Button>


          <button
            type="button"
            className="auth-link"
            onClick={() => navigate("/")}
          >
            Back
          </button>

        </form>

      </div>
    </div>
  );
}


export default Register;