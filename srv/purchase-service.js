const cds = require("@sap/cds");

module.exports = cds.service.impl(async function () {

    const {
        PurchaseRequests,
        PurchaseRequestItems
    } = this.entities;


    this.before("CREATE", PurchaseRequests, req => {

        req.data.status = "DRAFT";

        let total = 0;

        if (req.data.items) {

            for (const item of req.data.items) {

                if (!item.quantity || item.quantity <= 0) {
                    return req.reject(
                        400,
                        "La cantidad debe ser mayor que cero"
                    );
                }

                if (!item.unitPrice || item.unitPrice <= 0) {
                    return req.reject(
                        400,
                        "El precio unitario debe ser mayor que cero"
                    );
                }

                item.subtotal =
                    Number(item.quantity) *
                    Number(item.unitPrice);

                total += item.subtotal;
            }

        }

        req.data.totalAmount = total;

    });


    this.before("CREATE", PurchaseRequestItems, req => {

        const {
            quantity,
            unitPrice
        } = req.data;

        if (!quantity || quantity <= 0) {
            return req.reject(
                400,
                "La cantidad debe ser mayor que cero"
            );
        }

        if (!unitPrice || unitPrice <= 0) {
            return req.reject(
                400,
                "El precio unitario debe ser mayor que cero"
            );
        }

        req.data.subtotal =
            Number(quantity) *
            Number(unitPrice);

    });

    this.on("submit", PurchaseRequests, async req => {

        const ID = req.params[0].ID;

        const tx = cds.tx(req);

        const request = await tx.run(
            SELECT.one
                .from(PurchaseRequests)
                .where({ ID })
        );

        if (!request) {
            return req.reject(
                404,
                "La solicitud no existe"
            );
        }

        if (request.status !== "DRAFT") {
            return req.reject(
                400,
                "Solo las solicitudes en estado DRAFT pueden enviarse"
            );
        }

        const items = await tx.run(
            SELECT
                .from(PurchaseRequestItems)
                .where({ request_ID: ID }));

        if (!items.length) {
            return req.reject(
                400,
                "La solicitud debe contener al menos un item"
            );
        }

        const totalAmount = items.reduce(
            (total, item) =>
                total + Number(item.subtotal || 0),
            0
        );

        await tx.run(UPDATE(PurchaseRequests)
            .set({
                status: "SUBMITTED",
                totalAmount
            })
            .where({ ID }));

        return tx.run(
            SELECT.one
                .from(PurchaseRequests)
                .where({ ID })
        );

    });

    this.on("approve", PurchaseRequests, async req => {

        const ID = req.params[0].ID;

        const tx = cds.tx(req);

        const request = await tx.run(
            SELECT.one
                .from(PurchaseRequests)
                .where({ ID }));

        if (!request) {
            return req.reject(
                404,
                "La solicitud no existe"
            );
        }

        if (request.status !== "SUBMITTED") {
            return req.reject(
                400,
                "Solo las solicitudes enviadas pueden aprobarse"
            );
        }

        await tx.run(UPDATE(PurchaseRequests)
            .set({
                status: "APPROVED"
            })
            .where({ ID }));

        return tx.run(
            SELECT.one
                .from(PurchaseRequests)
                .where({ ID })
        );

    });

    this.on("reject", PurchaseRequests, async req => {

        const ID = req.params[0].ID;

        const tx = cds.tx(req);

        const request = await tx.run(
            SELECT.one
                .from(PurchaseRequests)
                .where({ ID })
        );

        if (!request) {
            return req.reject(
                404,
                "La solicitud no existe"
            );
        }

        if (request.status !== "SUBMITTED") {
            return req.reject(
                400,
                "Solo las solicitudes enviadas pueden rechazarse"
            );
        }

        await tx.run(UPDATE(PurchaseRequests)
            .set({
                status: "REJECTED"
            })
            .where({ ID }));

        return tx.run(
            SELECT.one
                .from(PurchaseRequests)
                .where({ ID })
        );

    });

    this.before("UPDATE", PurchaseRequests, async req => {

        const ID = req.data.ID || req.params?.[0]?.ID;

        const tx = cds.tx(req);

        const current = await tx.run(
            SELECT.one
                .from(PurchaseRequests)
                .where({ ID })
        );

        if (!current) {
            return req.reject(
                404,
                "La solicitud no existe"
            );
        }

        if (current.status !== "DRAFT") {
            return req.reject(
                400,
                "Solo las solicitudes en estado DRAFT pueden modificarse"
            );
        }

        if (
            req.data.status &&
            req.data.status !== current.status
        ) {
            return req.reject(
                400,
                "El estado no puede modificarse directamente"
            );
        }

    });

    this.before("UPDATE", PurchaseRequestItems, async req => {

        const tx = cds.tx(req);

        const ID = req.data.ID || req.params?.[0]?.ID;

        const currentItem = await tx.run(
            SELECT.one
                .from(PurchaseRequestItems)
                .where({ ID })
        );

        if (!currentItem) {
            return req.reject(
                404,
                "El item no existe"
            );
        }

        const parentRequest = await tx.run(
            SELECT.one
                .from(PurchaseRequests)
                .where({
                    ID: currentItem.request_ID
                })
        );

        if (!parentRequest) {
            return req.reject(
                404,
                "La solicitud asociada no existe"
            );
        }

        if (parentRequest.status !== "DRAFT") {
            return req.reject(
                400,
                "No se pueden modificar items de una solicitud que ya fue enviada"
            );
        }

    });    

    this.before("DELETE", PurchaseRequestItems, async req => {

        const tx = cds.tx(req);

        const ID = req.data.ID || req.params?.[0]?.ID;

        const currentItem = await tx.run(
            SELECT.one
                .from(PurchaseRequestItems)
                .where({ ID })
        );

        if (!currentItem) {
            return req.reject(
                404,
                "El item no existe"
            );
        }

        const parentRequest = await tx.run(
            SELECT.one
                .from(PurchaseRequests)
                .where({
                    ID: currentItem.request_ID
                })
        );

        if (!parentRequest) {
            return req.reject(
                404,
                "La solicitud asociada no existe"
            );
        }

        if (parentRequest.status !== "DRAFT") {
            return req.reject(
                400,
                "No se pueden eliminar items de una solicitud que ya fue enviada"
            );
        }

    });

});

