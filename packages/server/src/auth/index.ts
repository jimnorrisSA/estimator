import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express } from "express";

const ALLOWED_DOMAIN = "soulassembly.com";

export function setupAuth(app: Express) {
  app.use(
    session({
      secret: process.env.SESSION_SECRET ?? "dev-secret-change-me",
      resave: false,
      saveUninitialized: false,
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID ?? "",
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        callbackURL: "/api/auth/google/callback",
      },
      (_accessToken, _refreshToken, profile, done) => {
        const email = profile.emails?.[0]?.value ?? "";
        if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
          return done(null, false, { message: "Domain not allowed" });
        }
        return done(null, { id: profile.id, email, name: profile.displayName });
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user));
  passport.deserializeUser((user, done) => done(null, user as Express.User));

  app.get(
    "/api/auth/google",
    passport.authenticate("google", { scope: ["profile", "email"] })
  );

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", { failureRedirect: "/" }),
    (_req, res) => res.redirect("/")
  );

  app.get("/api/auth/me", (req, res) => {
    if (req.isAuthenticated()) return res.json(req.user);
    res.status(401).json({ error: "Not authenticated" });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => res.json({ ok: true }));
  });
}
