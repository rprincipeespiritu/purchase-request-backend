
const cds = require("@sap/cds");

async function ensureCurrentUser(req) {

    const identityId = req.user?.id;
    console.log("datos del usuario CIS actual: " + JSON.stringify(req.user));

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

    // 1. Buscar por identidad autenticada
    let user = await tx.run(
        SELECT.one.from(Users)
            .where({ identityId })
    );

    // 2. Compatibilidad con usuarios locales antiguos
    if (!user) {
        user = await tx.run(
            SELECT.one.from(Users)
                .where`username = ${identityId} and identityId is null`
        );
    }

    // 3. Registrar usuario nuevo
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
            SELECT.one.from(Users)
                .where({ identityId })
        );

    } else {

        // 4. Actualizar información del usuario
        const changes = {};

        if (!user.identityId) {
            changes.identityId = identityId;
        }

        if (user.email !== email) {
            changes.email = email;
        }

        if (user.fullName !== fullName) {
            changes.fullName = fullName;
        }

        if (Object.keys(changes).length > 0) {

            await tx.run(
                UPDATE(Users)
                    .set(changes)
                    .where({ ID: user.ID })
            );

            user = await tx.run(
                SELECT.one.from(Users)
                    .where({ ID: user.ID })
            );
        }
    }

    return user;
}

module.exports = { ensureCurrentUser };
