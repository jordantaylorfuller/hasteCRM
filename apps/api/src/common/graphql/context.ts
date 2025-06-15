export function createGraphQLContext({ req, res }: any) {
  // Ensure req has necessary Passport methods for GraphQL
  if (req) {
    req.login =
      req.login ||
      (() => {
        return undefined;
      });
    req.logIn = req.logIn || req.login;
    req.logout =
      req.logout ||
      (() => {
        return undefined;
      });
    req.logOut = req.logOut || req.logout;
    req.isAuthenticated = req.isAuthenticated || (() => !!req.user);
  }
  return { req, res };
}