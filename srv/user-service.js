const cds = require("@sap/cds");

module.exports = cds.service.impl(function () {

    const { Users } = cds.entities("com.portfolio.purchase");

    this.on("getCurrentUser", async (req) => {

        const username = req.user.id;

        if (!username || username === "anonymous") {
            return req.reject(401, "Usuario no autenticado");
        }

        // Atributos proporcionados por el proveedor de identidad.
        const attrs = req.user.attr || {};

        const email =
            attrs.email ||
            (username.includes("@") ? username : null);

        const fullName =
            attrs.name ||
            attrs.givenName ||
            email ||
            username;

        if (!email) {
            return req.reject(
                422,
                "La identidad autenticada no proporciona un correo"
            );
        }

        let user = await SELECT.one
            .from(Users)
            .where({ username });

        if (!user) {

            try {
                await INSERT.into(Users).entries({
                    username,
                    fullName,
                    email
                });
            } catch (error) {
                // Una petición simultánea pudo crear el usuario.
                const existing = await SELECT.one
                    .from(Users)
                    .where({ username });

                if (!existing) {
                    throw error;
                }
            }

            user = await SELECT.one
                .from(Users)
                .where({ username });
        }

        return {
            ID: user.ID,
            username: user.username,
            fullName: user.fullName,
            email: user.email
        };

    });

});