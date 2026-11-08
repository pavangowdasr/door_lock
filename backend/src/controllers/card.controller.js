import Card from '../models/Card.js';
import Enrollment from '../models/Enrollment.js';
import { normalizeUID } from '../utils/normalizeUID.js';

/**
 * Register a new RFID card.
 * POST /api/cards
 */
export async function registerCard(req, res, next) {
  try {
    const { uid, label, enrollmentId } = req.body || {};

    if (!uid) {
      return res.status(400).json({
        success: false,
        message: 'UID is required',
      });
    }

    let normalizedUID;
    try {
      normalizedUID = normalizeUID(uid);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    // Check for existing card with this UID
    const existingCard = await Card.findOne({ uid: normalizedUID });
    if (existingCard) {
      return res.status(409).json({
        success: false,
        message: `Card with UID '${normalizedUID}' is already registered`,
      });
    }

    const card = await Card.create({
      uid: normalizedUID,
      label: typeof label === 'string' ? label.trim() : '',
      status: 'active',
    });

    // If registered via remote enrollment session, mark session as completed
    if (enrollmentId && typeof enrollmentId === 'string' && enrollmentId.trim()) {
      await Enrollment.findOneAndUpdate(
        { enrollmentId: enrollmentId.trim() },
        { status: 'completed', completedAt: new Date() }
      );
    }

    return res.status(201).json({
      success: true,
      message: 'Card registered successfully',
      data: card,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List cards with pagination and optional status filter.
 * GET /api/cards
 */
export async function listCards(req, res, next) {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.status) {
      if (!['active', 'revoked'].includes(req.query.status)) {
        return res.status(400).json({
          success: false,
          message: "Status filter must be either 'active' or 'revoked'",
        });
      }
      filter.status = req.query.status;
    }

    const [cards, total] = await Promise.all([
      Card.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Card.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      data: cards,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Retrieve a specific card by UID.
 * GET /api/cards/:uid
 */
export async function getCardByUID(req, res, next) {
  try {
    const { uid } = req.params;

    let normalizedUID;
    try {
      normalizedUID = normalizeUID(uid);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    const card = await Card.findOne({ uid: normalizedUID });
    if (!card) {
      return res.status(404).json({
        success: false,
        message: `Card with UID '${normalizedUID}' not found`,
      });
    }

    return res.status(200).json({
      success: true,
      data: card,
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Update a card's status (active or revoked).
 * PATCH /api/cards/:uid/status
 */
export async function updateCardStatus(req, res, next) {
  try {
    const { uid } = req.params;
    const { status } = req.body || {};

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status field is required in request body",
      });
    }

    if (!['active', 'revoked'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Allowed values are 'active' or 'revoked'.",
      });
    }

    let normalizedUID;
    try {
      normalizedUID = normalizeUID(uid);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    const card = await Card.findOneAndUpdate(
      { uid: normalizedUID },
      { status },
      { new: true, runValidators: true }
    );

    if (!card) {
      return res.status(404).json({
        success: false,
        message: `Card with UID '${normalizedUID}' not found`,
      });
    }

    return res.status(200).json({
      success: true,
      message: `Card status updated to '${status}'`,
      data: card,
    });
  } catch (error) {
    next(error);
  }
}
