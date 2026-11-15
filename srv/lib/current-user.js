const cds = require("@sap/cds");

async function ensureCurrentUser(req) {
    const identityId = req.user?.id;

    if (!identityId || identityId === "anonymous") {
        return req.reject(401, "Usuario no autenticado");
    }

    const attrs = req.user.attr || {};

    const email =
        attrs.email ||
        (identityId.includes("@") ? identityId : null);

    if (!email) {
        return req.reject(
            422,
            "La identidad autenticada no proporciona un correo"
        );
    }

    const fullName =
        attrs.name ||
        [attrs.givenName, attrs.familyName]
            .filter(Boolean)
            .join(" ") ||
        email;

    const tx = cds.tx(req);
    const { Users } = cds.entities("com.portfolio.purchase");

    // Buscar por identidad autenticada.
    let user = await tx.run(
        SELECT.one.from(Users).where({ identityId })
    );

    // Compatibilidad con usuarios locales existentes.
    if (!user) {
        user = await tx.run(
            SELECT.one.from(Users).where({
                username: identityId,
                identityId: null
            })
        );
    }

    if (!user) {
        await tx.run(
            INSERT.into(Users).entries({
                identityId,
                username: identityId,
                email,
                fullName
            })
        );

        user = await tx.run(
            SELECT.one.from(Users).where({ identityId })
        );
    } else {
        await tx.run(
            UPDATE(Users)
                .set({
                    identityId,
                    email,
                    fullName
                })
                .where({ ID: user.ID })
        );

        user = await tx.run(
            SELECT.one.from(Users).where({ ID: user.ID })
        );
    }

    return user;
}

module.exports = { ensureCurrentUser };