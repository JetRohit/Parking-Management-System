import { useNavigate } from "react-router-dom";
import Button from "../../components/common/Button";


function RoleSelection() {
  const navigate = useNavigate();


  return (
    <div className="auth-page">
      <div className="auth-container">

        <div className="auth-heading">
          <h1>PMS</h1>
          <p>Parking Management System</p>
        </div>


        <div className="auth-form">

          <h2>Existing User</h2>

          <Button
            type="button"
            onClick={() => navigate("/login?role=user")}
          >
            Login
          </Button>


          <h2 style={{ marginTop: "24px" }}>
            New User
          </h2>

          <Button
            type="button"
            onClick={() => navigate("/user/register")}
          >
            Register
          </Button>


          <h2 style={{ marginTop: "24px" }}>
            Employee
          </h2>

          <Button
            type="button"
            onClick={() => navigate("/login?role=employee")}
          >
            Login
          </Button>


          <h2 style={{ marginTop: "24px" }}>
            Admin
          </h2>

          <Button
            type="button"
            onClick={() => navigate("/login?role=admin")}
          >
            Login
          </Button>

        </div>

      </div>
    </div>
  );
}


export default RoleSelection;