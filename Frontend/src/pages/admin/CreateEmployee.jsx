import { useState } from "react";
import Button from "../../components/common/Button";
import Input from "../../components/common/Input";
import apiRequest from "../../services/api";

function CreateEmployee() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const passwordsMatch =
    password === confirmPassword;

  const isFormValid =
    username.trim() !== "" &&
    password.trim() !== "" &&
    confirmPassword.trim() !== "" &&
    passwordsMatch;

  async function handleSubmit(event) {
    event.preventDefault();

    if (!isFormValid || submitting) {
      return;
    }

    setMessage("");
    setError("");
    setSubmitting(true);

    try {
      const response = await apiRequest("/employees", {
        method: "POST",
        body: JSON.stringify({
          username: username.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Failed to create employee"
        );
      }

      setMessage("Employee created successfully.");

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
    <div>
      <div className="page-header">
        <h1>Create Employee</h1>
        <p>Create a new employee account.</p>
      </div>

      <form
        className="content-form"
        onSubmit={handleSubmit}
      >
        <Input
          label="Username"
          name="employeeUsername"
          value={username}
          onChange={(event) =>
            setUsername(event.target.value)
          }
          placeholder="Enter employee username"
          autoComplete="off"
          required
        />

        <Input
          label="Password"
          name="employeePassword"
          type="password"
          value={password}
          onChange={(event) =>
            setPassword(event.target.value)
          }
          placeholder="Enter employee password"
          autoComplete="new-password"
          required
        />

        <Input
          label="Confirm Password"
          name="confirmEmployeePassword"
          type="password"
          value={confirmPassword}
          onChange={(event) =>
            setConfirmPassword(event.target.value)
          }
          placeholder="Re-enter employee password"
          autoComplete="new-password"
          required
        />

        {confirmPassword !== "" && !passwordsMatch && (
          <p className="password-error">
            Passwords do not match.
          </p>
        )}

        {error && (
          <p className="form-error">{error}</p>
        )}

        {message && (
          <p className="form-success">{message}</p>
        )}

        <Button
          type="submit"
          disabled={!isFormValid || submitting}
        >
          {submitting
            ? "Creating Employee..."
            : "Create Employee"}
        </Button>
      </form>
    </div>
  );
}

export default CreateEmployee;