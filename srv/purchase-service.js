const cds = require("@sap/cds");

module.exports = cds.service.impl(async function () {

    const {
        PurchaseRequests,
        PurchaseRequestItems
    } = this.entities;

    const db = cds.entities("com.portfolio.purchase");

    // =========================================================
    // HELPERS
    // =========================================================

    function validateItem(quantity, unitPrice, req) {

        if (quantity == null || Number(quantity) <= 0) {
            return req.reject(
                400,
                "La cantidad debe ser mayor que cero"
            );
        }

        if (unitPrice == null || Number(unitPrice) <= 0) {
            return req.reject(
                400,
                "El precio unitario debe ser mayor que cero"
            );
        }
    }


    async function validateDraftRequest(tx, requestID, req) {

        const request = await tx.run(
            SELECT.one
                .from(PurchaseRequests)
                .where({ ID: requestID })
        );

        if (!request) {
            return req.reject(404, "La solicitud no existe");
        }

        if (request.status !== "DRAFT") {
            return req.reject(
                400,
                "Solo se pueden modificar solicitudes en estado DRAFT"
            );
        }

        const user = await tx.run(
            SELECT.one
                .from(db.Users)
                .where({ username: req.user.id })
        );

        if (!user) {
            return req.reject(
                403,
                "El usuario autenticado no está registrado"
            );
        }

        if (request.requester_ID !== user.ID) {
            return req.reject(
                403,
                "No puede modificar una solicitud de otro usuario"
            );
        }

        return request;
    }


    async function recalculateTotal(tx, requestID) {

        const items = await tx.run(
            SELECT
                .from(PurchaseRequestItems)
                .where({ request_ID: requestID })
        );

        const total = items.reduce(
            (sum, item) =>
                sum + Number(item.subtotal || 0),
            0
        );

        await tx.run(
            UPDATE(PurchaseRequests)
                .set({ totalAmount: total })
                .where({ ID: requestID })
        );
    }


    // =========================================================
    // PURCHASE REQUESTS
    // =========================================================

    this.before("CREATE", PurchaseRequests, async req => {

        const tx = cds.tx(req);

        // ==========================================
        // USUARIO AUTENTICADO
        // ==========================================

        const username = req.user.id;

        const user = await tx.run(
            SELECT.one
                .from(db.Users)
                .where({ username })
        );

        if (!user) {
            return req.reject(
                403,
                "El usuario autenticado no está registrado"
            );
        }

        // Nunca confiar en requester_ID enviado por frontend
        req.data.requester_ID = user.ID;

        // El departamento también se obtiene del usuario
        req.data.department_ID = user.department_ID;

        // Toda solicitud nueva comienza como DRAFT
        req.data.status = "DRAFT";


        // ==========================================
        // CALCULAR ITEMS
        // ==========================================

        let total = 0;

        if (req.data.items) {

            for (const item of req.data.items) {

                validateItem(
                    item.quantity,
                    item.unitPrice,
                    req
                );

                item.subtotal =
                    Number(item.quantity) *
                    Number(item.unitPrice);

                total += item.subtotal;
            }
        }

        req.data.totalAmount = total;
    });


    this.before("UPDATE", PurchaseRequests, async req => {

        const tx = cds.tx(req);

        const ID =
            req.data.ID ||
            req.params?.[0]?.ID;

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

        const protectedFields = [
            "requester_ID",
            "department_ID",
            "totalAmount",
            "requestNumber",
            "requestDate"
        ];

        for (const field of protectedFields) {
            if (Object.prototype.hasOwnProperty.call(req.data, field)) {
                return req.reject(
                    400,
                    `El campo ${field} no puede modificarse directamente`
                );
            }
        }

        if (current.status !== "DRAFT") {
            return req.reject(
                400,
                "Solo las solicitudes DRAFT pueden modificarse"
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


    // =========================================================
    // SUBMIT
    // =========================================================

    this.on("submit", PurchaseRequests, async req => {

        const tx = cds.tx(req);
        const ID = req.params[0].ID;

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

        const user = await tx.run(
            SELECT.one
                .from(db.Users)
                .where({ username: req.user.id })
        );

        if (!user) {
            return req.reject(
                403,
                "El usuario autenticado no está registrado"
            );
        }

        if (request.requester_ID !== user.ID) {
            return req.reject(
                403,
                "No puede enviar una solicitud perteneciente a otro usuario"
            );
        }

        if (request.status !== "DRAFT") {
            return req.reject(
                400,
                "Solo las solicitudes DRAFT pueden enviarse"
            );
        }

        const items = await tx.run(
            SELECT
                .from(PurchaseRequestItems)
                .where({ request_ID: ID })
        );

        if (!items.length) {
            return req.reject(
                400,
                "La solicitud debe contener al menos un item"
            );
        }

        const total = items.reduce(
            (sum, item) =>
                sum + Number(item.subtotal || 0),
            0
        );

        await tx.run(
            UPDATE(PurchaseRequests)
                .set({
                    status: "SUBMITTED",
                    totalAmount: total
                })
                .where({ ID })
        );

        return tx.run(
            SELECT.one
                .from(PurchaseRequests)
                .where({ ID })
        );
    });


    // =========================================================
    // APPROVE
    // =========================================================

    this.on("approve", PurchaseRequests, async req => {

        const tx = cds.tx(req);
        const ID = req.params[0].ID;

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
                "Solo las solicitudes SUBMITTED pueden aprobarse"
            );
        }

        await tx.run(
            UPDATE(PurchaseRequests)
                .set({ status: "APPROVED" })
                .where({ ID })
        );

        return tx.run(
            SELECT.one
                .from(PurchaseRequests)
                .where({ ID })
        );
    });


    // =========================================================
    // REJECT
    // =========================================================

    this.on("reject", PurchaseRequests, async req => {

        const tx = cds.tx(req);
        const ID = req.params[0].ID;

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
                "Solo las solicitudes SUBMITTED pueden rechazarse"
            );
        }

        await tx.run(
            UPDATE(PurchaseRequests)
                .set({ status: "REJECTED" })
                .where({ ID })
        );

        return tx.run(
            SELECT.one
                .from(PurchaseRequests)
                .where({ ID })
        );
    });


    // =========================================================
    // PURCHASE REQUEST ITEMS - CREATE
    // =========================================================

    this.before("CREATE", PurchaseRequestItems, async req => {

        const tx = cds.tx(req);
        const requestID = req.data.request_ID;

        if (!requestID) {
            return req.reject(
                400,
                "El item debe pertenecer a una solicitud"
            );
        }

        await validateDraftRequest(
            tx,
            requestID,
            req
        );

        validateItem(
            req.data.quantity,
            req.data.unitPrice,
            req
        );

        req.data.subtotal =
            Number(req.data.quantity) *
            Number(req.data.unitPrice);
    });


    this.after("CREATE", PurchaseRequestItems, async (data, req) => {

        const tx = cds.tx(req);

        await recalculateTotal(
            tx,
            data.request_ID
        );
    });


    // =========================================================
    // PURCHASE REQUEST ITEMS - UPDATE
    // =========================================================

    this.before("UPDATE", PurchaseRequestItems, async req => {

        const tx = cds.tx(req);

        if (Object.prototype.hasOwnProperty.call(req.data, "request_ID")) {
            return req.reject(
                400,
                "No se permite cambiar la solicitud asociada al ítem"
            );
        }

        const ID =
            req.data.ID ||
            req.params?.[0]?.ID;

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

        await validateDraftRequest(
            tx,
            currentItem.request_ID,
            req
        );

        const quantity =
            req.data.quantity ??
            currentItem.quantity;

        const unitPrice =
            req.data.unitPrice ??
            currentItem.unitPrice;

        validateItem(
            quantity,
            unitPrice,
            req
        );

        req.data.subtotal =
            Number(quantity) *
            Number(unitPrice);
    });


    this.after("UPDATE", PurchaseRequestItems, async (data, req) => {

        const tx = cds.tx(req);

        const item = await tx.run(
            SELECT.one
                .from(PurchaseRequestItems)
                .where({ ID: data.ID })
        );

        if (item) {
            await recalculateTotal(
                tx,
                item.request_ID
            );
        }
    });


    // =========================================================
    // PURCHASE REQUEST ITEMS - DELETE
    // =========================================================

    this.before("DELETE", PurchaseRequestItems, async req => {

        const tx = cds.tx(req);

        const ID =
            req.data.ID ||
            req.params?.[0]?.ID;

        const item = await tx.run(
            SELECT.one
                .from(PurchaseRequestItems)
                .where({ ID })
        );

        if (!item) {
            return req.reject(
                404,
                "El item no existe"
            );
        }

        await validateDraftRequest(
            tx,
            item.request_ID,
            req
        );

        req._parentRequestID =
            item.request_ID;
    });


    this.after("DELETE", PurchaseRequestItems, async (_, req) => {

        if (!req._parentRequestID) {
            return;
        }

        const tx = cds.tx(req);

        await recalculateTotal(
            tx,
            req._parentRequestID
        );
    });

    this.before('READ', 'Departments', (req) => {
        console.log('[AUTH DEBUG] Usuario XSUAA:', req.user.id);
        console.log('[AUTH DEBUG] Roles:', {
            Requester: req.user.is('Requester'),
            Approver: req.user.is('Approver')
        });
    });

});