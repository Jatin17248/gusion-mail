import { NextResponse } from "next/server";

export async function GET() {
  const spec = {
    openapi: "3.0.3",
    info: {
      title: "Gusion Mail Developer API",
      description: "Integrate custom workflows, message queues, automations, and tickets directly with Gusion Mail.",
      version: "1.0.0",
    },
    servers: [
      {
        url: "https://mail.gusion.in/api/v1",
        description: "Production Server",
      },
    ],
    security: [
      {
        BearerAuth: [],
      },
    ],
    paths: {
      "/messages": {
        get: {
          summary: "List Messages",
          description: "Retrieve recent Gmail messages for the connected organization account.",
          operationId: "listMessages",
          responses: {
            "200": {
              description: "Successful response",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      messages: { type: "array", items: { type: "object" } },
                    },
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
            "403": { description: "Forbidden" },
          },
        },
        post: {
          summary: "Send Message",
          description: "Send a new email message using the connected Gmail account.",
          operationId: "sendMessage",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["to", "subject", "body"],
                  properties: {
                    to: { type: "string", format: "email" },
                    subject: { type: "string" },
                    body: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Message sent successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      messageId: { type: "string" },
                      threadId: { type: "string" },
                    },
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
            "403": { description: "Forbidden" },
          },
        },
      },
      "/tickets": {
        get: {
          summary: "List Tickets",
          description: "Retrieve all support tickets for the organization.",
          operationId: "listTickets",
          responses: {
            "200": {
              description: "Successful response",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      tickets: { type: "array", items: { type: "object" } },
                    },
                  },
                },
              },
            },
            "401": { description: "Unauthorized" },
          },
        },
        post: {
          summary: "Create Ticket",
          description: "Insert a new support ticket into the shared support queue.",
          operationId: "createTicket",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["subject", "fromEmail"],
                  properties: {
                    subject: { type: "string" },
                    fromEmail: { type: "string", format: "email" },
                    fromName: { type: "string" },
                    snippet: { type: "string" },
                    status: { type: "string", enum: ["open", "pending", "resolved"] },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Ticket created successfully",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      ticket: { type: "object" },
                    },
                  },
                },
              },
            },
          },
        },
        patch: {
          summary: "Update Ticket",
          description: "Update a ticket's status, assignment, or tags.",
          operationId: "updateTicket",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["id"],
                  properties: {
                    id: { type: "string" },
                    status: { type: "string", enum: ["open", "pending", "resolved"] },
                    assignedUserId: { type: "string", nullable: true },
                    tags: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Ticket updated successfully",
            },
          },
        },
      },
      "/contacts": {
        get: {
          summary: "List Contacts",
          description: "Retrieve all synced contacts inside the organization.",
          operationId: "listContacts",
          responses: {
            "200": {
              description: "Successful response",
            },
          },
        },
        post: {
          summary: "Upsert Contact",
          description: "Create or update contact details and VIP settings.",
          operationId: "upsertContact",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email"],
                  properties: {
                    email: { type: "string", format: "email" },
                    name: { type: "string" },
                    isVip: { type: "boolean" },
                    enrichment: { type: "object" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Successful upsert",
            },
          },
        },
      },
      "/automations": {
        post: {
          summary: "Trigger Automation Rule",
          description: "Manually fire a rule's action sequence against a thread or message payload.",
          operationId: "triggerAutomation",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["ruleId"],
                  properties: {
                    ruleId: { type: "string" },
                    threadId: { type: "string" },
                    gmailMessageId: { type: "string" },
                    payload: { type: "object" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Automation executed",
            },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
        },
      },
    },
  };

  return NextResponse.json(spec);
}
