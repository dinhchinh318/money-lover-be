const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
});

const getResetPasswordTemplate = (userName, otp) => {
  return {
    subject: "Password Reset Verification Code",
    html: `
      <h1>Password Reset Request</h1>
      <p>Hello ${userName},</p>
      <p>You have requested to reset your password. Here is your verification code:</p>
      <h2 style="color: #d32f2f;">${otp}</h2>
      <p>This code will expire in 10 minutes.</p>
      <p>If you did not request a password reset, please ignore this email.</p>
    `,
  };
};


const getWelcomeTemplate = (userName) => {
  return {
    subject: "Welcome to BingCloth – Fashion with Personality",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2c3e50; text-align: center;">Welcome to BingCloth! 👗🧥</h1>
        <p style="font-size: 16px;">Hello <strong>${userName}</strong>,</p>
        <p style="font-size: 16px;">We’re excited to welcome you to the BingCloth fashion community! Your account has been successfully created.</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
          <h2 style="color: #2c3e50; margin-top: 0;">With BingCloth, you can:</h2>
          <ul style="list-style-type: none; padding: 0;">
            <li style="margin: 10px 0;">🛍️ Explore the latest fashion collections</li>
            <li style="margin: 10px 0;">🎁 Enjoy exclusive offers for members</li>
            <li style="margin: 10px 0;">📦 Experience fast and convenient delivery service</li>
          </ul>
        </div>
        <p style="font-size: 16px;">If you have any questions, feel free to contact our support team anytime.</p>
        <p style="font-size: 16px;">Best regards,<br>The BingCloth Team</p>
      </div>
    `,
  };
};


const sendResetPasswordEmail = async (to, userName, otp) => {
  try {
    const template = getResetPasswordTemplate(userName, otp);

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: to,
      subject: template.subject,
      html: template.html,
    };

    await transporter.sendMail(mailOptions);
    return {
      status: true,
      message: "Email sent successfully",
    };
  } catch (error) {
    console.error("Error sending email:", error);
    return {
      status: false,
      message: "Cannot send email: " + error.message,
    };
  }
};

const sendWelcomeEmail = async (to, userName) => {
  try {
    const template = getWelcomeTemplate(userName);

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: to,
      subject: template.subject,
      html: template.html,
    };

    await transporter.sendMail(mailOptions);
    return {
      status: true,
      message: "Email sent successfully",
    };
  } catch (error) {
    console.error("Error sending email:", error);
    return {
      status: false,
      message: "Cannot send email: " + error.message,
    };
  }
};

module.exports = {
  sendResetPasswordEmail,
  sendWelcomeEmail,
};