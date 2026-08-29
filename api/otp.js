const nodemailer = require("nodemailer");

const otpStore = global.otpStore || new Map();
global.otpStore = otpStore;

module.exports = async function handler(req, res) {
  // CORS allow
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const email = req.query.mail || req.query.email;
    const otp = req.query.otp;

    // ========== SEND OTP ==========
    if (email && !otp) {
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 5 * 60 * 1000; // 5 min

      otpStore.set(email.toLowerCase(), { otp: generatedOtp, expiresAt });

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      });

      await transporter.sendMail({
        from: `"OTP Service" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Your OTP Code",
        html: `
          <div style="font-family: Arial; max-width: 480px; margin: auto; padding: 20px;">
            <h2>OTP Verification</h2>
            <p>Your OTP is:</p>
            <h1 style="letter-spacing: 6px; color: #2563eb;">${generatedOtp}</h1>
            <p>Valid for 5 minutes.</p>
          </div>
        `,
      });

      return res.status(200).json({
        success: true,
        message: "OTP sent successfully",
      });
    }

    // ========== VERIFY OTP ==========
    if (email && otp) {
      const key = email.toLowerCase();
      const stored = otpStore.get(key);

      if (!stored) {
        return res.status(400).json({
          success: false,
          error: "OTP not found. Please request a new one.",
        });
      }

      if (Date.now() > stored.expiresAt) {
        otpStore.delete(key);
        return res.status(400).json({
          success: false,
          error: "OTP expired",
        });
      }

      if (stored.otp !== otp.toString()) {
        return res.status(400).json({
          success: false,
          error: "Invalid OTP",
        });
      }

      otpStore.delete(key);

      return res.status(200).json({
        success: true,
        message: "OTP verified successfully",
      });
    }

    // Invalid request
    return res.status(400).json({
      success: false,
      error: "Use ?mail=email for send OR ?mail=email&otp=123456 for verify",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({
      success: false,
      error: "Something went wrong",
    });
  }
};
