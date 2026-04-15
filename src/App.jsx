import { Routes, Route } from "react-router-dom";
import Landing from "./components/Landing";
import Login from "./components/Login";
import Register from "./components/Register";
import ProfileSetup from "./components/ProfileSetup";
import CommonDashboard from "./components/CommonDashboard";
import UpdateProfile from "./components/UpdateProfile";
import SoloQuestions from "./components/Soloquestions";
import TeamQuestions from "./components/Teamquestions";
import SoloDashboard from "./components/SoloDashboard";
import TeamDashboard from "./components/TeamDashboard";
import Notifications from "./components/Notifications";
import UpdateSoloProfile from "./components/Updatesoloprofile";
import UpdateTeamProfile from "./components/Updateteamprofile";
import YourProjects from "./components/Yourprojects";
import MentorLogin from "./components/MentorLogin";
import MentorRegister from "./components/MentorRegister";
import MentorProfile from "./components/MentorProfile";
import MentorDashboard from "./components/MentorDashboard";
import UpdateMentorProfile from "./components/Updatementorprofile";
import MentorNotifications from "./components/MentorNotifications";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/setup" element={<ProfileSetup />} />
      <Route path="/dashboard" element={<CommonDashboard />} />
      <Route path="/update-profile" element={<UpdateProfile />} />
      <Route path="/solo-questions" element={<SoloQuestions />} />
      <Route path="/team-questions" element={<TeamQuestions />} />
      <Route path="/solo-dashboard/:projectId" element={<SoloDashboard />} />
      <Route path="/team-dashboard/:projectId" element={<TeamDashboard />} />
      <Route path="/notifications" element={<Notifications />} />
      <Route path="/your-projects" element={<YourProjects />} />
      <Route path="/update-solo-profile/:projectId" element={<UpdateSoloProfile />} />
      <Route path="/update-team-profile/:projectId" element={<UpdateTeamProfile />} />
       <Route path="/mentor/login"           element={<MentorLogin />} />
    <Route path="/mentor/register"        element={<MentorRegister />} />
    <Route path="/mentor/profile"         element={<MentorProfile />} />
    <Route path="/mentor/dashboard"       element={<MentorDashboard />} />
    <Route path="/mentor/profile/update"  element={<UpdateMentorProfile />} />
    <Route path="/mentor/notifications"   element={<MentorNotifications />} />
    </Routes>
  );
}