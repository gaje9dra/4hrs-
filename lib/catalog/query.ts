      });

      const configuredOptions = product.optionTypes.map(({ optionType, sortOrder }) => ({
        id: optionType.id,
        name: optionType.name,
        normalizedName: optionType.normalizedName,
        sortOrder,
        values: optionType.values,
      }));

      // Some existing catalog records store size directly on ProductVariant rather
      // than through the newer option-type relation. Expose that legacy size data
      // through the same public option contract so the inline SIZE selector works
      // without introducing a separate product page or changing checkout semantics.
      const hasConfiguredSize = configuredOptions.some(
        (option) => option.normalizedName === "size" || option.name.trim().toLowerCase() === "size",
      );
      const normalizedLegacySizes = variants.map((variant) => variant.size?.trim()).filter(Boolean);
      // Only synthesize a legacy Size option when every published variant has
      // a concrete size. Partial legacy data cannot be represented as a valid
      // variant matrix without inventing a selection, so leave it unmodified.
      const hasCompleteLegacySizes =
        variants.length > 0 && normalizedLegacySizes.length === variants.length;
      const legacySizes = hasCompleteLegacySizes
        ? [...new Set(normalizedLegacySizes)]
        : [];
      const sizeOptionId = "legacy-size";
      const sizeValues = legacySizes.map((size, sortOrder) => ({
        id: `${sizeOptionId}:${size!.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        displayName: size!,
        normalizedValue: size!.toLowerCase(),
        hex: null,
        swatch: null,
        sortOrder,
      }));
      const options = !hasConfiguredSize && sizeValues.length
        ? [...configuredOptions, {
            id: sizeOptionId,
            name: "Size",
            normalizedName: "size",
            sortOrder: -1,
            values: sizeValues,
          }].sort((a, b) => a.sortOrder - b.sortOrder)
        : configuredOptions;