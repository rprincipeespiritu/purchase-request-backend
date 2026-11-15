const cds = require("@sap/cds");

const {
    ensureCurrentUser
} = require("./lib/current-user");

module.exports = cds.service.impl(function () {

    this.on("getCurrentUser", async (req) => {

        const user = await ensureCurrentUser(req);

        return {
            ID: user.ID,
            username: user.username,
            fullName: user.fullName,
            email: user.email
        };

    });

});